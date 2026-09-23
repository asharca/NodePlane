package checker

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"encore.dev/beta/errs"
	"encore.dev/storage/sqldb"
	subsvc "subs-check-re/services/subscription"
)

// evaluateRuleForNode runs a single rule definition against an HTTP client (optionally
// routed through a user-owned proxy node) and returns the test result with debug trace.
// Used by both the TestRule API endpoint and any in-process rule evaluation
// (CLI tools, batch validators, etc.).
func evaluateRuleForNode(ctx context.Context, userID, ruleType string, definition json.RawMessage, nodeID string) (*TestRuleResult, error) {
	httpClient, nodeName, cleanup, err := openTestClient(ctx, userID, nodeID)
	if err != nil {
		return nil, err
	}
	if cleanup != nil {
		defer cleanup()
	}

	start := time.Now()
	dr := &DebugRecorder{}

	if ruleType == "condition" {
		return runConditionTest(ctx, httpClient, ruleType, definition, dr, start, nodeName), nil
	}

	rule := &PlatformRule{RuleType: ruleType, Definition: definition}
	outcome, err := runRule(ctx, httpClient, rule, dr)
	ok := outcome.Unlocked
	ms := time.Since(start).Milliseconds()

	trace := &DebugTrace{Platform: ruleType, Result: ok, Steps: dr.Steps}

	// Script engines (JS/TS/Tengo/Lua) may make multiple http_get calls; surface the
	// LAST response as the top-level Body/StatusCode/FinalURL/ResponseHeaders so the
	// Body and Rendered tabs in the UI show something useful. Trace still has every step.
	statusCode, finalURL, body, respHeaders := extractConditionArtifacts(dr.Steps)

	if err != nil {
		return &TestRuleResult{
			OK: false, Error: err.Error(), DurationMs: ms,
			NodeName:        nodeName,
			Trace:           trace,
			StatusCode:      statusCode,
			FinalURL:        finalURL,
			Body:            body,
			ResponseHeaders: respHeaders,
		}, nil
	}
	return &TestRuleResult{
		OK: ok, DurationMs: ms,
		NodeName:        nodeName,
		Trace:           trace,
		StatusCode:      statusCode,
		FinalURL:        finalURL,
		Body:            body,
		ResponseHeaders: respHeaders,
	}, nil
}

// openTestClient never silently falls back to direct access for an explicit node.
// Ownership comes from its subscription, including nodes not checked yet.
func openTestClient(ctx context.Context, userID, nodeID string) (*http.Client, string, func(), error) {
	if nodeID == "" {
		return &http.Client{Timeout: 15 * time.Second}, "", nil, nil
	}
	var name, subscriptionID string
	var configJSON []byte
	err := db.QueryRow(ctx, `SELECT name, subscription_id, config FROM nodes WHERE id=$1`, nodeID).Scan(&name, &subscriptionID, &configJSON)
	if err == sqldb.ErrNoRows {
		return nil, "", nil, errs.B().Code(errs.NotFound).Msg("test node not found").Err()
	}
	if err != nil {
		return nil, "", nil, errs.B().Code(errs.Internal).Msg("failed to load test node").Err()
	}
	sub, err := subsvc.GetSubscriptionByID(ctx, &subsvc.GetByIDParams{ID: subscriptionID})
	if err != nil || sub.UserID != userID {
		return nil, "", nil, errs.B().Code(errs.NotFound).Msg("test node not found").Err()
	}
	var mapping map[string]any
	if err := json.Unmarshal(configJSON, &mapping); err != nil {
		return nil, "", nil, errs.B().Code(errs.InvalidArgument).Msg("invalid test node configuration").Err()
	}
	pc := newProxyClient(mapping)
	if pc == nil {
		return nil, "", nil, errs.B().Code(errs.InvalidArgument).Msg("unsupported test node configuration").Err()
	}
	return pc.Client, name, func() { pc.close() }, nil
}

func runConditionTest(ctx context.Context, client *http.Client, ruleType string, def json.RawMessage, dr *DebugRecorder, start time.Time, nodeName string) *TestRuleResult {
	ok, err := runConditionRule(ctx, client, def, dr)
	ms := time.Since(start).Milliseconds()
	trace := &DebugTrace{Platform: ruleType, Result: ok, Steps: dr.Steps}

	if err != nil {
		trace.Result = false
		return &TestRuleResult{OK: false, Error: err.Error(), DurationMs: ms, NodeName: nodeName, Trace: trace}
	}

	statusCode, finalURL, body, respHeaders := extractConditionArtifacts(dr.Steps)
	return &TestRuleResult{
		OK:              ok,
		StatusCode:      statusCode,
		FinalURL:        finalURL,
		Body:            body,
		ResponseHeaders: respHeaders,
		NodeName:        nodeName,
		DurationMs:      ms,
		Trace:           trace,
	}
}

// extractConditionArtifacts pulls the last HTTP response status/url/body/headers out of debug
// steps so the test UI can render them as a structured response panel. The full body lives in
// the response step's "body" field (no truncation).
func extractConditionArtifacts(steps []DebugStep) (statusCode int, finalURL, body string, respHeaders map[string]string) {
	for _, step := range steps {
		if step.Type == "http_response" && len(step.Details) > 0 {
			var details map[string]any
			if json.Unmarshal(step.Details, &details) != nil {
				continue
			}
			if v, ok := details["status_code"].(float64); ok {
				statusCode = int(v)
			}
			if v, ok := details["body"].(string); ok {
				body = v
			}
			if v, ok := details["final_url"].(string); ok && v != "" {
				finalURL = v
			}
			if h, ok := details["headers"].(map[string]any); ok {
				respHeaders = make(map[string]string, len(h))
				for k, val := range h {
					if sv, ok := val.(string); ok {
						respHeaders[k] = sv
					}
				}
			}
		}
	}
	return
}

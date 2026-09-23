// services/checker/local_check.go
package checker

import (
	"context"
	"net/http"
	"sync"
	"time"

	encauth "encore.dev/beta/auth"
	"encore.dev/beta/errs"

	authsvc "subs-check-re/services/auth"
)

// LocalUnlockResult holds platform accessibility from the server's own network.
type LocalUnlockResult struct {
	Platforms map[string]PlatformOutcome `json:"platforms"`
	IP        string                     `json:"ip"`
	Country   string                     `json:"country"`
}

// GetLocalUnlock checks the signed-in user's enabled rules.
//
//encore:api auth method=GET path=/network-unlock
func GetLocalUnlock(ctx context.Context) (*LocalUnlockResult, error) {
	claims, ok := encauth.Data().(*authsvc.UserClaims)
	if !ok || claims == nil || claims.UserID == "" {
		return nil, errs.B().Code(errs.Unauthenticated).Msg("missing auth data").Err()
	}
	return localUnlockForUser(ctx, claims.UserID)
}

// GetLocalUnlockForUser is an internal service boundary for background jobs.
// Cron callbacks have no browser authentication context: callers must pass the
// owner from the stored channel, not rely on auth.Data() from an earlier request.
//
//encore:api private method=GET path=/internal/network-unlock/:userID
func GetLocalUnlockForUser(ctx context.Context, userID string) (*LocalUnlockResult, error) {
	if userID == "" {
		return nil, errs.B().Code(errs.InvalidArgument).Msg("user id is required").Err()
	}
	return localUnlockForUser(ctx, userID)
}

func localUnlockForUser(ctx context.Context, userID string) (*LocalUnlockResult, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	checkCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	rules, err := loadUserRules(checkCtx, userID)
	if err != nil {
		return nil, errs.B().Code(errs.Internal).Msg("failed to load rules").Err()
	}
	enabled := make([]*PlatformRule, 0, len(rules))
	for _, r := range rules {
		if r.Enabled {
			enabled = append(enabled, r)
		}
	}

	res := LocalUnlockResult{Platforms: runRulesAgainst(checkCtx, client, enabled)}
	res.IP, res.Country = getProxyInfo(checkCtx, client)

	if err := checkCtx.Err(); err != nil {
		return nil, errs.B().Code(errs.DeadlineExceeded).Msg("check timed out").Err()
	}
	return &res, nil
}

// runRulesAgainst evaluates the given rules concurrently against the HTTP client.
func runRulesAgainst(ctx context.Context, client *http.Client, rules []*PlatformRule) map[string]PlatformOutcome {
	type kv struct {
		key     string
		outcome PlatformOutcome
	}
	out := make(chan kv, len(rules))
	var wg sync.WaitGroup
	for _, rule := range rules {
		wg.Add(1)
		go func(r *PlatformRule) {
			defer wg.Done()
			defer func() { _ = recover() }()
			outcome, _ := runRule(ctx, client, r, nil)
			out <- kv{key: r.Key, outcome: outcome}
		}(rule)
	}
	wg.Wait()
	close(out)

	result := make(map[string]PlatformOutcome, len(rules))
	for e := range out {
		result[e.key] = e.outcome
	}
	return result
}

// Package aliveprobe implements the HTTP reachability check used by the node
// checker. Its request semantics intentionally match Mihomo's URLTest endpoint:
// a completed HTTP exchange proves that the proxy transport is reachable,
// regardless of the target's response status.
package aliveprobe

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/metacubex/mihomo/constant"
)

const (
	DefaultTestURL    = constant.DefaultTestURL
	CloudflareTestURL = "https://cp.cloudflare.com/generate_204"
	GoogleTestURL     = "https://www.google.com/generate_204"
	URLTestTimeout    = 30 * time.Second
)

const targetCount = 3

// Targets returns the ordered endpoints used across the three bounded probe
// attempts. A user-configured endpoint remains first; independent HTTPS
// endpoints fill the remaining attempts so one blocked probe host does not
// make a working proxy look dead.
func Targets(configured string) []string {
	candidates := make([]string, 0, targetCount+1)
	if configured = strings.TrimSpace(configured); configured != "" {
		candidates = append(candidates, configured)
	}
	candidates = append(candidates, DefaultTestURL, CloudflareTestURL, GoogleTestURL)

	targets := make([]string, 0, targetCount)
	seen := make(map[string]struct{}, len(candidates))
	for _, candidate := range candidates {
		if _, ok := seen[candidate]; ok {
			continue
		}
		seen[candidate] = struct{}{}
		targets = append(targets, candidate)
		if len(targets) == targetCount {
			break
		}
	}
	return targets
}

// Probe sends one HEAD request without following redirects. Any HTTP response
// means the proxy completed a dial and an HTTP exchange, so it is reachable.
// Only request construction, dialing, TLS, transport, or context errors count
// as probe failures.
func Probe(ctx context.Context, client *http.Client, testURL string) (alive bool, latencyMs int) {
	if client == nil {
		return false, 0
	}
	if strings.TrimSpace(testURL) == "" {
		testURL = DefaultTestURL
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, testURL, nil)
	if err != nil {
		return false, 0
	}

	probeClient := *client
	// Mihomo's URLTest owns a 30s client ceiling while the caller's context may
	// impose a shorter overall budget. Do not inherit an unrelated client's
	// smaller timeout: it would turn reachable 10–30s nodes into false negatives.
	probeClient.Timeout = URLTestTimeout
	probeClient.CheckRedirect = func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}

	start := time.Now()
	resp, err := probeClient.Do(req)
	if err != nil {
		return false, 0
	}
	defer resp.Body.Close()

	latencyMs = int(time.Since(start).Milliseconds())
	if latencyMs < 1 {
		latencyMs = 1
	}
	return true, latencyMs
}

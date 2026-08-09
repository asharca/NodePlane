package checker

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

type probeTestRoundTripFunc func(*http.Request) (*http.Response, error)

func (f probeTestRoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestProbeLatency_MatchesMihomoReachabilitySemantics(t *testing.T) {
	var gotMethod, gotURL string
	client := &http.Client{Transport: probeTestRoundTripFunc(func(req *http.Request) (*http.Response, error) {
		gotMethod = req.Method
		gotURL = req.URL.String()
		return &http.Response{
			StatusCode: http.StatusBadGateway,
			Body:       http.NoBody,
			Header:     make(http.Header),
			Request:    req,
		}, nil
	})}

	alive, ms := probeLatency(context.Background(), client, "")
	if !alive {
		t.Fatal("a completed HTTP exchange must prove proxy reachability, even when the target returns 502")
	}
	if ms <= 0 {
		t.Fatalf("expected positive latency, got %d", ms)
	}
	if gotMethod != http.MethodHead {
		t.Fatalf("probe method = %s, want HEAD to match mihomo URLTest", gotMethod)
	}
	if gotURL != defaultAliveTestURL {
		t.Fatalf("default probe URL = %q, want %q", gotURL, defaultAliveTestURL)
	}
}

func TestProbeLatency_DoesNotFollowRedirect(t *testing.T) {
	followed := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path == "/redirected" {
			followed = true
			w.WriteHeader(http.StatusNoContent)
			return
		}
		http.Redirect(w, req, "/redirected", http.StatusFound)
	}))
	defer server.Close()

	alive, _ := probeLatency(context.Background(), server.Client(), server.URL)
	if !alive {
		t.Fatal("the redirect response itself proves reachability")
	}
	if followed {
		t.Fatal("latency probe followed a redirect; mihomo URLTest measures the first response")
	}
}

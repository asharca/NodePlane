package aliveprobe

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"

	"github.com/metacubex/mihomo/adapter"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestProbe_AnyHTTPResponseProvesReachability(t *testing.T) {
	for _, status := range []int{http.StatusForbidden, http.StatusNotFound, http.StatusBadGateway} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			var method string
			client := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				method = req.Method
				return &http.Response{
					StatusCode: status,
					Body:       http.NoBody,
					Header:     make(http.Header),
					Request:    req,
				}, nil
			})}

			alive, latency := Probe(context.Background(), client, DefaultTestURL)
			if !alive {
				t.Fatalf("HTTP %d completed through the proxy, want alive", status)
			}
			if latency <= 0 {
				t.Fatalf("latency = %d, want a positive value", latency)
			}
			if method != http.MethodHead {
				t.Fatalf("method = %s, want HEAD", method)
			}
		})
	}
}

func TestProbe_ParityWithMihomoURLTest(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		time.Sleep(5 * time.Millisecond)
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer server.Close()

	proxy, err := adapter.ParseProxy(map[string]any{"name": "DIRECT", "type": "direct"})
	if err != nil {
		t.Fatalf("parse direct proxy: %v", err)
	}
	defer proxy.Close()

	coreDelay, err := proxy.URLTest(context.Background(), server.URL, nil)
	if err != nil || coreDelay == 0 {
		t.Fatalf("mihomo URLTest: delay=%d err=%v, want a positive delay", coreDelay, err)
	}

	alive, delay := Probe(context.Background(), server.Client(), server.URL)
	if !alive || delay <= 0 {
		t.Fatalf("checker probe: alive=%v delay=%d, want Mihomo parity", alive, delay)
	}
}

func TestProbe_TransportErrorIsDead(t *testing.T) {
	client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return nil, errors.New("dial failed")
	})}

	alive, latency := Probe(context.Background(), client, DefaultTestURL)
	if alive || latency != 0 {
		t.Fatalf("got alive=%v latency=%d, want false/0", alive, latency)
	}
}

func TestProbe_DoesNotFollowRedirect(t *testing.T) {
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

	alive, _ := Probe(context.Background(), server.Client(), server.URL)
	if !alive {
		t.Fatal("redirect response should prove reachability")
	}
	if followed {
		t.Fatal("probe followed redirect instead of measuring the first response")
	}
}

func TestProbe_UsesMihomoTimeoutCeiling(t *testing.T) {
	var remaining time.Duration
	client := &http.Client{
		Timeout: 10 * time.Second,
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			deadline, ok := req.Context().Deadline()
			if !ok {
				t.Fatal("probe request has no timeout deadline")
			}
			remaining = time.Until(deadline)
			return &http.Response{
				StatusCode: http.StatusNoContent,
				Body:       http.NoBody,
				Header:     make(http.Header),
				Request:    req,
			}, nil
		}),
	}

	alive, _ := Probe(context.Background(), client, DefaultTestURL)
	if !alive {
		t.Fatal("probe should complete")
	}
	if remaining < 25*time.Second {
		t.Fatalf("probe deadline remaining = %v, want Mihomo's 30s ceiling instead of the caller client's 10s timeout", remaining)
	}
}

func TestProbe_RespectsShorterContextDeadline(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var remaining time.Duration
	client := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		deadline, ok := req.Context().Deadline()
		if !ok {
			t.Fatal("probe request has no context deadline")
		}
		remaining = time.Until(deadline)
		return &http.Response{
			StatusCode: http.StatusNoContent,
			Body:       http.NoBody,
			Header:     make(http.Header),
			Request:    req,
		}, nil
	})}

	alive, _ := Probe(ctx, client, DefaultTestURL)
	if !alive {
		t.Fatal("probe should complete")
	}
	if remaining > 6*time.Second {
		t.Fatalf("probe deadline remaining = %v, want the caller's shorter context deadline", remaining)
	}
}

func TestTargets(t *testing.T) {
	tests := []struct {
		name       string
		configured string
		want       []string
	}{
		{
			name: "defaults",
			want: []string{DefaultTestURL, CloudflareTestURL, GoogleTestURL},
		},
		{
			name:       "configured first",
			configured: "https://custom.example/health",
			want:       []string{"https://custom.example/health", DefaultTestURL, CloudflareTestURL},
		},
		{
			name:       "deduplicates configured builtin",
			configured: CloudflareTestURL,
			want:       []string{CloudflareTestURL, DefaultTestURL, GoogleTestURL},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Targets(tt.configured); !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("Targets(%q) = %v, want %v", tt.configured, got, tt.want)
			}
		})
	}
}

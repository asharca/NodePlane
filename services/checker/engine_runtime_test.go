package checker

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestTengoOutputAssignment(t *testing.T) {
	for _, tc := range []struct {
		name, code string
		want       bool
	}{
		{"true", "output = true", true},
		{"false", "output = false", false},
		{"default", "", false},
		{"prelude", "output = fixture", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			raw, _ := json.Marshal(ScriptDef{Prelude: "fixture := true", Code: tc.code})
			got, err := runTengoRule(context.Background(), http.DefaultClient, raw, &DebugRecorder{})
			if err != nil || got != tc.want {
				t.Fatalf("got %v, %v; want %v", got, err, tc.want)
			}
		})
	}
}

func TestScriptEnginesUseLocalHTTPFixture(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		_, _ = w.Write([]byte("fixture-response"))
	}))
	defer srv.Close()
	for _, engine := range []string{"js", "ts", "lua", "tengo"} {
		t.Run(engine, func(t *testing.T) {
			code := fmt.Sprintf("return http_get(%q).status == 200;", srv.URL)
			if engine == "tengo" {
				code = fmt.Sprintf("r := http_get(%q); output = r.status == 200", srv.URL)
			}
			raw, _ := json.Marshal(ScriptDef{Code: code})
			trace := &DebugRecorder{}
			var got bool
			var err error
			switch engine {
			case "lua":
				got, err = runLuaRule(context.Background(), srv.Client(), raw, trace)
			case "tengo":
				got, err = runTengoRule(context.Background(), srv.Client(), raw, trace)
			default:
				var result PlatformOutcome
				result, err = runJSRule(context.Background(), srv.Client(), engine, raw, trace)
				got = result.Unlocked
			}
			if err != nil || !got {
				t.Fatalf("engine failed: %v %v", got, err)
			}
			status, _, body, _ := extractConditionArtifacts(trace.Steps)
			if status != 200 || body != "fixture-response" {
				t.Fatalf("HTTP trace missing: %d %q", status, body)
			}
		})
	}
}

func TestScriptEnginesRespectCancellation(t *testing.T) {
	for _, engine := range []string{"js", "ts", "lua", "tengo"} {
		t.Run(engine, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
			defer cancel()
			code := "while (true) {}"
			if engine == "lua" {
				code = "while true do end"
			}
			if engine == "tengo" {
				code = "for { }"
			}
			raw, _ := json.Marshal(ScriptDef{Code: code})
			start := time.Now()
			var err error
			switch engine {
			case "lua":
				_, err = runLuaRule(ctx, http.DefaultClient, raw, nil)
			case "tengo":
				_, err = runTengoRule(ctx, http.DefaultClient, raw, nil)
			default:
				_, err = runJSRule(ctx, http.DefaultClient, engine, raw, nil)
			}
			if err == nil {
				t.Fatal("expected cancellation error")
			}
			if ctx.Err() == nil {
				t.Fatalf("script failed before deadline, not a cancellation test: %v", err)
			}
			if time.Since(start) > 2*time.Second {
				t.Fatal("script ignored cancellation")
			}
		})
	}
}

package notify

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type senderRoundTrip func(*http.Request) (*http.Response, error)

func (f senderRoundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestSenderConfigurationValidation(t *testing.T) {
	if senderFor("unknown", nil) != nil {
		t.Fatal("unknown sender must be rejected")
	}
	for _, kind := range []string{"webhook", "telegram", "email"} {
		t.Run(kind, func(t *testing.T) {
			s := senderFor(kind, []byte(`{}`))
			if s.SendMessage(context.Background(), "fixture", "subject", "body") == nil {
				t.Fatal("missing configuration accepted")
			}
			if s.SendPayload(context.Background(), "fixture", map[string]string{"x": "y"}) == nil {
				t.Fatal("missing configuration accepted for payload")
			}
		})
	}
}

func TestWebhookMethodHeadersAndPayload(t *testing.T) {
	var method, header, contentType string
	var payload map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		method, header, contentType = r.Method, r.Header.Get("X-Fixture"), r.Header.Get("Content-Type")
		_ = json.NewDecoder(r.Body).Decode(&payload)
		w.WriteHeader(204)
	}))
	defer srv.Close()
	config, _ := json.Marshal(webhookConfig{URL: srv.URL, Method: "PUT", Headers: map[string]string{"X-Fixture": "present"}})
	err := senderFor("webhook", config).SendPayload(context.Background(), "fixture", map[string]any{"available": 3})
	if err != nil {
		t.Fatal(err)
	}
	if method != "PUT" || header != "present" || contentType != "application/json" || payload["available"] != float64(3) {
		t.Fatalf("unexpected request: %s %s %s %#v", method, header, contentType, payload)
	}
}

func TestWebhookFailureAndCancellation(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(503) }))
	defer srv.Close()
	config, _ := json.Marshal(webhookConfig{URL: srv.URL})
	s := senderFor("webhook", config)
	if err := s.SendMessage(context.Background(), "fixture", "", "body"); err == nil || !strings.Contains(err.Error(), "503") {
		t.Fatalf("expected HTTP failure, got %v", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := s.SendMessage(ctx, "fixture", "", "body"); err == nil || !errors.Is(err, context.Canceled) {
		t.Fatalf("expected cancellation, got %v", err)
	}
}

func TestTelegramRequestAndHTTPFailure(t *testing.T) {
	// Replace only the transport within this serial unit test. No real bot token
	// is used and no connection to Telegram is opened.
	original := http.DefaultTransport
	t.Cleanup(func() { http.DefaultTransport = original })
	status := 200
	var payload map[string]string
	http.DefaultTransport = senderRoundTrip(func(r *http.Request) (*http.Response, error) {
		if r.Method != "POST" || r.URL.String() != "https://api.telegram.org/botfixture-token/sendMessage" {
			t.Errorf("unexpected request destination: %s %s", r.Method, r.URL)
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Error("missing JSON content type")
		}
		payload = nil
		_ = json.NewDecoder(r.Body).Decode(&payload)
		return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(`{"ok":true}`)), Header: http.Header{}, Request: r}, nil
	})
	s := senderFor("telegram", []byte(`{"bot_token":"fixture-token","chat_id":"fixture-chat"}`))
	if err := s.SendMessage(context.Background(), "fixture", "", "<b>fixture</b>"); err != nil {
		t.Fatal(err)
	}
	if payload["chat_id"] != "fixture-chat" || payload["parse_mode"] != "HTML" || payload["text"] != "<b>fixture</b>" {
		t.Fatalf("bad message: %#v", payload)
	}
	if err := s.SendPayload(context.Background(), "fixture", map[string]bool{"ok": true}); err != nil {
		t.Fatal(err)
	}
	if payload["parse_mode"] != "" || payload["text"] != `{"ok":true}` {
		t.Fatalf("bad payload: %#v", payload)
	}
	status = 429
	if err := s.SendMessage(context.Background(), "fixture", "", "fixture"); err == nil || !strings.Contains(err.Error(), "429") {
		t.Fatalf("expected rate-limit failure: %v", err)
	}
}

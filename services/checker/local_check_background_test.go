package checker

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
)

func TestBackgroundUnlockUsesExplicitOwner(t *testing.T) {
	ctx := context.Background()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(200) }))
	defer srv.Close()
	owner, other := "background-"+uuid.New().String(), "other-"+uuid.New().String()
	for _, row := range []struct{ user, key string }{{owner, "owned_local"}, {other, "foreign_local"}} {
		definition, _ := json.Marshal(map[string]any{"url": srv.URL, "status_code": 200})
		_, err := db.Exec(ctx, `INSERT INTO platform_rules (id,user_id,name,key,icon,enabled,rule_type,definition,is_default,sort_order,created_at,updated_at)
		VALUES ($1,$2,$3,$3,'',true,'condition',$4,false,0,NOW(),NOW())`, uuid.New().String(), row.user, row.key, definition)
		if err != nil {
			t.Fatal(err)
		}
	}
	// No OverrideAuthInfo: this represents a Cron callback, not a browser request.
	result, err := GetLocalUnlockForUser(ctx, owner)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Platforms) != 1 || !result.Platforms["owned_local"].Unlocked {
		t.Fatalf("wrong owner's rules: %#v", result.Platforms)
	}
	if _, found := result.Platforms["foreign_local"]; found {
		t.Fatal("another user's rule leaked into the report")
	}
}

func TestBackgroundUnlockRequiresOwner(t *testing.T) {
	if _, err := GetLocalUnlockForUser(context.Background(), ""); err == nil {
		t.Fatal("missing owner must be rejected")
	}
}

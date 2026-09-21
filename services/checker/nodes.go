// services/checker/nodes.go
package checker

import (
	"context"

	encauth "encore.dev/beta/auth"
	"encore.dev/beta/errs"

	authsvc "subs-check-re/services/auth"
	subsvc "subs-check-re/services/subscription"
)

// SetNodeEnabledParams is the request body for PATCH /nodes/:nodeID.
type SetNodeEnabledParams struct {
	Enabled bool `json:"enabled"`
}

// SetNodeEnabled enables or disables a single node for the authenticated user.
// Disabled nodes are excluded from subscription exports but still appear in results.
//
//encore:api auth method=PATCH path=/nodes/:nodeID
func SetNodeEnabled(ctx context.Context, nodeID string, p *SetNodeEnabledParams) error {
	_ = encauth.Data().(*authsvc.UserClaims)

	var subscriptionID string
	if err := db.QueryRow(ctx,
		`SELECT subscription_id FROM nodes WHERE id = $1`, nodeID,
	).Scan(&subscriptionID); err != nil {
		return errs.B().Code(errs.NotFound).Msg("node not found").Err()
	}
	if _, err := subsvc.GetSubscription(ctx, subscriptionID); err != nil {
		return errs.B().Code(errs.NotFound).Msg("node not found").Err()
	}

	res, err := db.Exec(ctx, `UPDATE nodes SET enabled = $2 WHERE id = $1`, nodeID, p.Enabled)
	if err != nil {
		return errs.B().Code(errs.Internal).Msg("db error").Err()
	}
	if res.RowsAffected() == 0 {
		return errs.B().Code(errs.NotFound).Msg("node not found").Err()
	}
	return nil
}

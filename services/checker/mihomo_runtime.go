package checker

import "github.com/metacubex/mihomo/component/resolver"

// The embedded Mihomo library defaults to IPv4-only until the full core
// executor applies its general configuration. This service embeds adapters
// directly and never runs that executor, so enable dual-stack resolution here;
// otherwise IPv6 literals and AAAA-only proxy servers are silently reported as
// dead before an alive probe can start.
func init() {
	resolver.DisableIPv6 = false
}

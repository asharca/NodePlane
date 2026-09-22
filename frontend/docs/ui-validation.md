# UI validation

## Fast checks

Run from `frontend/`:

```sh
bun install --frozen-lockfile
bun run check-types
bun run test:unit
bun run build
```

## Browser smoke checks

The GitHub `Frontend CI` workflow starts the production build on loopback, installs Playwright 1.55.0 outside application dependencies, and executes `scripts/ui-smoke.mjs`. It retains screenshots and a JSON report in the `nodeplane-ui-preview` artifact for 14 days.

The browser API is intercepted with synthetic fixtures. Tests do not sign into a real account, run real node checks, or change production schedules. They exercise sign-in submission, password visibility, theme switching, collapsing navigation, opening/closing a node-group dialog, page navigation, mobile drawer selection, search, horizontal overflow at desktop/mobile widths, request failure/retry and empty-state rendering. Browser errors fail the run. A failure screenshot and report are captured when possible.

For a local run after building:

```sh
npm install --prefix /tmp/nodeplane-browser --no-package-lock --ignore-scripts playwright@1.55.0
/tmp/nodeplane-browser/node_modules/.bin/playwright install chromium
PORT=3000 HOST=127.0.0.1 node .output/server/index.mjs
# In another terminal, from frontend/:
PLAYWRIGHT_RUNTIME=/tmp/nodeplane-browser node scripts/ui-smoke.mjs
```

Generated files go to `frontend/test-results/ui/`; do not commit screenshots of real account data.

## Scope boundary

These are UI smoke and regression checks, not real-backend end-to-end coverage. Before deploying, exercise real sign-in, invitations, saves in each settings section, subscriptions/direct-node imports, run/cancel/reconnect checks, historical result selection, exports, notifications, schedules and rule editing/testing. Keep the main branch's deployment workflow unchanged until that review is complete.

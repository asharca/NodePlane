# NodePlane UI integration

## Source and ownership

NodePlane uses the source-first [Asharca UI](https://github.com/asharca/ui) registry, documented at https://asharca.github.io/ui/llms.txt. The source is pinned to `df97cdeb2306dcf3453bb4db4e93c70060163bf0`, not fetched from a moving branch at build time.

`src/components/asharca/registry-source.json` records the selected components and their dependency closure. The upstream MIT license is retained alongside the source. `motion` and `radix-ui` are locked in `bun.lock`. No runtime CDN, font service, analytics, or remote component loader is required.

## Layers

- `components/asharca`: vendored source components. WorkspaceShell/WorkspaceSidebar implement the inset workspace and accessible mobile drawer. Page, Card, Input, Checkbox and SearchInput are used directly by redesigned pages.
- `components/ui`: NodePlane adapters keep existing application contracts. Button renders the Asharca motion button through Base UI's `render` API. Input delegates to the vendored field. Badge, Card, Progress and EmptyState reuse Asharca sources while preserving call sites.
- Existing Base UI compound dialogs, selects, dropdown menus, checkboxes and switches retain their event, portal and focus-management contracts. Their styling inherits the new tokens. They are not falsely represented as direct upstream replacements.
- `styles.css`: application-owned light/dark, focus, shape, semantic state and responsive tokens. No component should use a separate hard-coded light-only palette.

## Intentional source adaptation

Asharca Input's label is optional in this consumer. With no label/description/error, it renders a bare input so old external Label and flex/grid arrangements remain valid. With field metadata, it renders the upstream labelled field and associates help/error text. All other upstream source is initially copied unchanged.

## Behavior and data

The API client, generated route tree, query keys, check requests, SSE progress, saved options and backend are unchanged. Client theme state is shared between controls, safe during SSR, reacts to system/storage events, and degrades to session state when storage is blocked. Signing out clears cached account data.

The home summary is based on existing groups and the latest job snapshot for each. Available/total counts include only snapshots whose status is completed. They are not a live-health measure, are not a count of unique nodes across groups, and exclude a group's older completed runs when its latest run is queued/running/failed. Failures and unavailable data are not displayed as a healthy zero.

Group navigation shows only a subscription URL's host, never URL credentials, query tokens, fragments or private paths. Full editing values remain available in the existing dialogs.

## Validation

From `frontend/`, run `bun install --frozen-lockfile`, `bun run check-types`, `bun run test:unit` and `bun run build`. Added regression tests cover adapters, dialog composition, submit/loading/ref semantics, search/filter state, progress accessibility, summary semantics, navigation and credential-safe presentation.

The pull request does not change production deployment configuration or merge itself. Test real backend flows before deployment: create/edit/delete a group, import a direct node, run/cancel a check, watch reconnecting SSE progress, select historical results, export nodes, edit rules, manage schedules, save every settings section, and confirm the session across reloads.

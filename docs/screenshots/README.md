# README screenshots

These PNG files are screenshots of the actual NodePlane frontend, captured by
`frontend/scripts/ui-smoke.mjs` in Chromium. The application API is replaced with
explicit synthetic fixtures **for this visual suite only**. Names, accounts,
metrics and subscription URLs are demonstration data, not production results.

The root and frontend READMEs reference these committed files with relative
paths, so their images do not expire with GitHub Actions artifacts.

| File | Viewport | View |
| --- | --- | --- |
| `workspace-light.png` | 1440 × 1000 | Light workspace |
| `workspace-dark.png` | 1440 × 1000 | Dark workspace |
| `login-light.png` | 1440 × 1000 | Sign-in |
| `create-group-dialog.png` | 1440 × 1000 | New group dialog |
| `workspace-mobile.png` | 390 × 844 | Mobile workspace |
| `settings-small-mobile.png` | 320 × 780 | Narrow settings layout |

To refresh them, run the visual suite described in
[`frontend/docs/ui-validation.md`](../../frontend/docs/ui-validation.md), inspect
the generated images, then copy the selected files from
`frontend/test-results/ui/`. Run `python3 tests/check_docs.py` from the repository
root to validate local documentation references and PNG dimensions.

Do not copy screenshots containing real credentials, private subscription URLs,
customer names or production data into this public repository. Passing the
visual suite does not replace the separate real-backend API and browser suites;
see [`docs/testing.md`](../testing.md).

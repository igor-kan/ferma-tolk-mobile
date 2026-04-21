# Contributing to Ferma.Tolk

## Quick Start

```bash
npm install        # install all dependencies
npm run dev        # start local dev server
npm test           # run unit + integration tests
npm run lint       # check code style
npm run format     # auto-format all files
npm run build      # production build
```

---

## Code Style

### Formatter: Prettier

All files are formatted by [Prettier](https://prettier.io). Config is in `.prettierrc`:

- `singleQuote: true`
- `semi: true`
- `trailingComma: 'es5'`
- `printWidth: 100`
- `tabWidth: 2`

Run `npm run format` before committing, or install the Prettier VS Code extension with "format on save".

### Linter: ESLint (flat config)

Config is in `eslint.config.js`. Key rules enforced:

| Rule                          | Severity                | Rationale                                             |
| ----------------------------- | ----------------------- | ----------------------------------------------------- |
| `no-unused-vars`              | error                   | Dead code is a maintenance hazard                     |
| `prettier/prettier`           | error                   | Consistent formatting                                 |
| `no-console`                  | warn (src), error (api) | Use structured logging (`logAuthEvent`, `secLog`)     |
| `boundaries/element-types`    | error                   | Prevent cross-domain imports (see Architecture below) |
| `import/no-duplicates`        | error                   | Duplicate imports are always a bug                    |
| `react-hooks/rules-of-hooks`  | error                   | React hooks must follow the rules                     |
| `react/no-unescaped-entities` | error                   | JSX text must escape `"` as `&quot;`                  |

**Suppression:** Use `// eslint-disable-next-line <rule>` with a brief comment explaining _why_. File-level disables are not allowed without a PR discussion.

**Unused variables:** Prefix intentionally unused bindings with `_` (e.g. `_err`, `_userId`). This satisfies `no-unused-vars` and signals intent to reviewers.

---

## Architecture and Import Boundaries

The `src/` directory is organized into feature domains. Imports must flow **inward only**:

```
src/
  features/<domain>/   — domain-specific components, hooks, services
  shared/              — reusable UI and API utilities (no domain knowledge)
  lib/                 — pure utilities, schemas, validators, storage
  App.jsx              — top-level composition root
```

**Allowed import directions:**

| From           | May import                                       |
| -------------- | ------------------------------------------------ |
| `features/<X>` | `features/<X>` (own domain), `shared/*`, `lib/*` |
| `shared/*`     | `shared/*`, `lib/*`                              |
| `lib/*`        | `lib/*` only                                     |
| `App.jsx`      | `features/*`, `shared/*`, `lib/*`                |

**Cross-feature imports are disallowed.** If two features need the same logic, extract it to `shared/` or `lib/`.

The `eslint-plugin-boundaries` rule enforces this at lint time and blocks PRs that violate it.

---

## Testing

- Tests use Node's built-in `node:test` runner (no Jest or Vitest).
- Unit tests live next to the code they test (`foo.js` → `foo.test.js`).
- API endpoint tests live in `api/*.test.js`.
- E2E tests live in `e2e/`.

Run all unit tests:

```bash
npm test
```

Run E2E tests (requires running dev server):

```bash
npm run test:e2e
```

All tests must pass before a PR can be merged. CI enforces this.

---

## CI / Pull Request Requirements

The GitHub Actions workflow (`.github/workflows/test.yml`) runs on every push and PR:

1. **`npm run lint`** — zero errors required; warnings are informational.
2. **`npm test`** — all 128+ unit/integration tests must pass.
3. **`npm run build`** — production bundle must compile without errors.
4. **E2E tests** — core user journeys must pass in a headless browser.

PRs that fail any CI step are blocked from merging.

---

## Commit Style

Use short, descriptive commit messages. Reference the FT ticket when applicable:

```
FT-032: add ESLint flat config with boundary rules
fix: remove unused React import in Dashboard
refactor: extract assistant intent detection to service layer
```

---

## Known Acceptable Warnings

These 5 ESLint warnings are intentional and do not need to be fixed:

| Warning                                | File                | Reason                                                              |
| -------------------------------------- | ------------------- | ------------------------------------------------------------------- |
| `react-hooks/exhaustive-deps`          | `App.jsx`           | Intentional dep array to avoid infinite loop on login state         |
| `react-hooks/exhaustive-deps`          | `useForecast.js`    | Stable userId reference — adding it causes unnecessary refetches    |
| `react-refresh/only-export-components` | `AuthContext.jsx`   | Context + Provider exported from same file (standard React pattern) |
| `react-refresh/only-export-components` | `UiContext.jsx`     | Same as above                                                       |
| `react-refresh/only-export-components` | `ErrorBoundary.jsx` | Exports both class component and helper hook                        |

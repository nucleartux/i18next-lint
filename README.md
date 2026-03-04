# i18next-lint

CLI tool to find **unused** and **missing** i18next translation keys in React/TypeScript projects.

## Comparison with similar tools

Many i18n linters scan a fixed set of files (e.g. `src/**/*.{ts,tsx}`). i18next-lint takes a different approach:

| Advantage | Description |
|-----------|-------------|
| **Entry-point & dependency graph** | You specify **entry** file(s); the tool follows static and dynamic `import()` from there via the TypeScript AST. Only **reachable** code is analyzed. Dead code is ignored (no false “unused key” in files you never import), and lazy-loaded routes/components are included when their modules are reachable from the entry. |
| **Monorepo / workspace aware** | Imports that resolve to workspace packages (not `node_modules`) are followed, so one entry can cover the whole app and shared packages. |
| **Plurals & context** | Understands i18next **plural** forms (both `simple` and `numeric`) and **context** (static and dynamic). Missing and extra keys are reported accurately for these patterns. |
| **Multi-project in one run** | A single config file can define multiple projects (e.g. several apps in a monorepo); one command lints all of them. |
| **Report-only** | Only reports issues; it does not modify files. Safe for CI and code review; use exit code and `--json` to integrate with scripts or editors. |

## Install

```bash
npm install i18next-lint
# or
bun add i18next-lint
```

## Usage

From your project root (where `i18next-lint.config.json` lives):

```bash
npx i18next-lint
```

**Options:**

| Option | Description |
|--------|-------------|
| `-c`, `--config <path>` | Config file path (default: `i18next-lint.config.json`) |
| `--json` | Output report as JSON |

**Exit code:** `0` when there are no issues, `1` when there are missing or extra keys.

## Configuration

Create `i18next-lint.config.json` in your project root (or pass a path with `--config`).

### Minimal config

```json
{
  "entry": "src/index.tsx",
  "translations": ["src/locales/en.json", "src/locales/ru.json"]
}
```

### Full config

```json
{
  "entry": ["src/index.tsx", "src/pages/*.tsx"],
  "translations": [
    { "file": "src/locales/en.json", "plurals": "simple" },
    { "file": "src/locales/ru-numeric.json", "plurals": "numeric" }
  ],
  "contextSeparator": "_",
  "pluralSeparator": "_"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `entry` | Yes | Entry point(s) to scan. A path, array of paths, or [glob](https://github.com/mrmlnc/fast-glob) (e.g. `src/**/*.tsx`). All reachable source files from these entries are analyzed. |
| `translations` | Yes | List of translation JSON files. Each item can be a path string or `{ "file": "...", "plurals": "simple" \| "numeric" }`. |
| `contextSeparator` | No | Separator between base key and context (default: `_`). |
| `pluralSeparator` | No | Separator between base key and plural forms (default: `_`). |

**Plural styles:**

- **`simple`** — keys like `item` and `item_plural`.
- **`numeric`** — keys like `item_0`, `item_1`, `item_2`, etc.

### Multiple projects

You can lint several apps in one run by using an array of configs (e.g. in a monorepo). Paths in each config are relative to the config file directory.

```json
[
  { "entry": "app1/src/index.tsx", "translations": ["app1/src/locales/en.json"] },
  { "entry": "app2/src/index.tsx", "translations": ["app2/src/locales/en.json"] }
]
```

## What it reports

- **Missing keys** — keys used in code (e.g. `t('foo')`) that are not in your translation files, with file and line.
- **Extra keys** — keys present in translation files that are never used in the scanned source.

Missing keys show which usage type applies (`singular` or `plural`) and which language files are missing the key. Extra keys show which language files contain them.

## JSON output

With `--json`, the tool prints a single object:

```json
{
  "missingKeys": ["some.key"],
  "missingKeyLocations": { "some.key": [{ "filePath": "src/App.tsx", "line": 10 }] },
  "missingKeyUsageTypes": { "some.key": "singular" },
  "extraKeys": ["unused.key"],
  "missingKeysByLanguage": { "some.key": ["en", "ru"] },
  "extraKeysByLanguage": { "unused.key": ["en", "ru"] }
}
```

Paths in `missingKeyLocations` are relative to the project root.

## License

MIT

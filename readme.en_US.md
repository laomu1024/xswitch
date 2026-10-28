<div align="center">

<a href="https://chromewebstore.google.com/detail/xswitch-v3/dgocjnalnkkghhpdfgjinkhjigkggjdg?hl=zh-CN&utm_source=ext_sidebar">
  <img width="440" src="https://img.alicdn.com/tfs/TB1yll4lyqAXuNjy1XdXXaYcVXa-880-560.png" alt="XSwitch">
</a>

# XSwitch-v3

**A secure, efficient Chrome extension for redirecting request URLs — making local development easy and happy.**

[![Chrome Web Store][badge-cws]][link-cws] [![Users][badge-cws-count]][link-cws] [![License][badge-license]][link-xswitch]

[简体中文](./readme.md) ｜ **English**

</div>

---

## 📖 Introduction

XSwitch is a [Chrome extension][link-cws] for **redirecting and forwarding HTTP request URLs**. Built on the browser-native `declarativeNetRequest` API (Manifest V3), it delivers both security and performance, helping developers easily proxy online resources to local services during development.

> The current **v3** release is upgraded from XSwitch and fully migrated from Manifest V2 to V3.

<div align="center">

<a href="https://chrome.google.com/webstore/detail/idkjhjggpffolpidfkikidcokdkdaogg">
  <img src="https://img.alicdn.com/tfs/TB1SNbynC_I8KJjy0FoXXaFnVXa-1672-1018.png" alt="XSwitch on Chrome Web Store">
</a>

</div>

## ✨ Features

**🔀 Request Forwarding**

- Three rule modes: **string replacement**, **regex matching**, and **inline JavaScript**
- **Custom request headers**: inject headers without changing the request URL
- Automatic **CORS** handling: injects `Access-Control-Allow-Origin: *` and related response headers
- One-click **browser cache disabling** to always load the latest resources
- **Global switch** to enable or disable all rules at any time

**🗂 Rule Management**

- **Rules grouping**: multiple config sets executed in the defined order
- 🔍 **Rule search** (v2.4.0): type to filter and quickly locate rules
- 📌 **Pin frequently used configs** (v2.4.0): pin high-frequency rules to the top of the list
- ✏️ **Rename / drag to sort / delete**: adjust rules freely; every group (including the default `Current`) is managed the same way
- 💾 **Import / export**: back up and share configs in one click

**⌨️ Editing Experience**

- Powered by **Monaco Editor** (same as VSCode), with [JSONC](https://komkom.github.io/) comment support
- Keyboard shortcuts, e.g. `⌘K` `⌘F` to format JSON
- Rule **auto-completion**

## 🚀 Usage

Each group is a JSONC config that is compiled into browser DNR rules as soon as you save. **A request applies only one matching rule** — rewrites are not chained, so keep rules mutually exclusive instead of relying on one rule following another.

> **Tip**: Forwarding an `HTTPS` URL to `http://127.0.0.1` won't trigger a browser security warning. If you usually use `localhost`, give this a try.

```js
{
  // Forwarding rules
  "proxy": [
    // 1) Exact replacement: match one URL and replace it with another
    [
      "//alinw.alicdn.com/platform/daily-test/isDaily.js",
      "//alinw.alicdn.com/platform/daily-test/isDaily.json"
    ],
    // 2) Partial replacement: capture the parts to keep and rebuild the URL
    ["(.*)alinw(.*)", "$1g$2"],
    // 3) Regex replacement: use $1, $2 to reference capture groups
    [
      "(.*)/platform/daily-test/(.*).js",
      "http://127.0.0.1:3000/daily-test/$2.js"
    ],
    // 4) Inline JavaScript: return a snippet of JS directly
    [
      "https://alinw.alicdn.com/platform/daily-test/isDaily.js",
      "data:text/javascript,window.__isDaily = true;"
    ]
  ],
  // URLs that need CORS enabled
  "cors": [
    "cors.a.com",
    "*.b.com"
  ],
  // Add request headers only, without changing the URL (pattern is a RE2 regex)
  "headers": [
    [
      "https://api.example.com(/.*)?",
      { "X-Debug": "1", "X-Env": "local" }
    ]
  ]
}
```

Browser-controlled headers such as `Host` and `Content-Length` cannot be modified.

### Rule fields and matching

| Field | Purpose | Format | Matching |
| --- | --- | --- | --- |
| `proxy` | Rewrite the request URL | `[["pattern", "replacement"], ...]` | RE2 regex, case-insensitive by default |
| `cors` | Inject CORS response headers | `["url pattern", ...]` | `urlFilter`: matches when the URL contains it; `*` is a wildcard, **not a regex** |
| `headers` | Inject/override request headers without changing the URL | `[["pattern", { "header": "value" }], ...]` | RE2 regex, case-insensitive by default |

- Capture groups are written as `$1`, `$2`; the extension converts them to the DNR `\1`, `\2` syntax. The replacement rebuilds the whole URL, so parts not referenced by a capture group are dropped.
- RE2 does not support lookarounds such as `(?=...)` or `(?<!...)`. Rejected rules are skipped automatically while the rest stay active; the badge shows a red `!` and the Service Worker console has the details.
- Applies to pages, XHR/fetch, scripts, stylesheets, images, fonts, and other resource types; WebSocket and media requests are not covered.

### headers rules

`headers` only injects or overrides request headers and **never changes the URL** — useful for tagging, environment switching, or letting a backend recognize local traffic.

```js
"headers": [
  // Every path under api.example.com, including the root
  ["https://api.example.com(/.*)?", { "X-Env": "local", "X-Debug": "1" }],
  // Only one directory
  ["https://api.example.com/v2/.*", { "X-Canary": "1" }]
]
```

- Existing headers with the same name are **overridden** (set semantics). Values can be numbers or booleans and are converted to strings; `null` values and empty objects are skipped.
- Like `proxy`, the pattern is a RE2 regex and is case-insensitive by default. Include the path in the pattern — a bare domain usually only matches the root URL.
- When `headers` and `cors` modify the same response header (for example `Access-Control-Allow-Origin`), the result depends on the browser; avoid overlapping rules.

### UI and menus

- **Global switch**: enables or disables all rules; the icon turns grey when off.
- **Disable cache**: clears the cache whenever rules are saved so the latest resources load.
- **CORS switch**: toggles CORS rewriting independently of forwarding rules.
- **Rule list**: search, group checkboxes, pin to top (display order only), rename, delete, drag to sort; `Current` is just the default group and behaves like any other. A red `!` next to a group name means its JSON is invalid; hover it for details.
- **More menu (⋯)**: export config, import config, Docs.
- **Badge**: the blue number counts active `proxy` + `headers` rules; a red `!` means some rules were rejected by the browser while the rest stay active.

📖 Full guide, rule semantics, and an interactive demo: the bundled offline help page [`docs/help.html`](./docs/help.html) (also available from the popup's **Docs** button). Legacy docs: [Yuque](https://yuque.com/jiushen/blog/xswitch-readme)

### Operate configs from JS (automation / agents)

Open `chrome-extension://<extension-id>/XSwitch.html` in a new tab; the page exposes a global `xswitch` object. Call it from the DevTools console or an automation tool (Playwright, browser MCP, etc.). Writes update storage immediately, the service worker rebuilds DNR rules, and the page list/editor refresh to match.

| Method | Description |
| --- | --- |
| `xswitch.list()` | List all groups as `{ id, name, active, pinnedAt, jsonc, config, error }` |
| `xswitch.get(nameOrId)` | Read one group; `null` if not found |
| `xswitch.add(name, config)` | Create a group; duplicate names are rejected |
| `xswitch.set(nameOrId, config)` | Replace a group's config with an object or JSONC string |
| `xswitch.remove(nameOrId)` | Delete a group and its stored config |
| `xswitch.setActive(nameOrId, active)` | Check / uncheck a group |
| `xswitch.getState()` | Read the global switches `{ enabled, clearCacheEnabled, corsEnabled }` |
| `xswitch.setState(patch)` | Update global switches; omitted fields stay unchanged |

```js
await xswitch.add('mock', { cors: ['m.api.com'] })
await xswitch.set('mock', { proxy: [['https://cdn.example.com/(.*)', 'http://localhost:3000/$1']] })
await xswitch.setActive('Current', false)
await xswitch.setState({ enabled: false, corsEnabled: false })
await xswitch.remove('mock')
```

- A group is effective only when `active === true` **and** `getState().enabled === true`; a non-empty `error` means the group's JSON is invalid.
- `add` / `set` validate JSONC first; invalid JSON, a missing group, or a duplicate name throws without writing.
- Open the page in a new tab: a toolbar popup closes on blur and terminates the script.

## 🛠 Local development

```bash
npm install        # Install dependencies
npm run dev        # Dev server at http://localhost:8088
npm run build      # Build into build/ (manifest, docs, Monaco)
npm test           # Jest unit tests
npm run test:e2e   # Playwright end-to-end tests (run build first)
```

To load the extension, open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the `build/` directory.

```text
src/
├── pages/xswitch/    # Popup (main.ts production build, xswitch.tsx dev build)
├── app.tsx           # Dev entry
├── background.ts     # Service Worker (DNR rules, CORS)
├── forward.ts        # Request forwarding logic
├── dnr-utils.ts      # DNR rule generation
├── chrome-storage.ts # Storage wrapper
└── constants.ts      # Constants and default config
docs/                 # Bundled offline help page
```

## 🔐 Permissions and privacy

- `declarativeNetRequest` + `<all_urls>`: rewrite requests and response headers according to your rules.
- `storage`: store rules and switches.
- `browsingData`: clear the browser cache only when **Disable cache** is on.

XSwitch does not collect or upload rules or browsing data.

## ❓ FAQ

- **Rules saved but not applied?** Check the global switch, whether the group is checked, whether a red `!` appears next to the group name (invalid JSON in that group), whether the badge shows a red `!`, and whether the browser served a cached response.
- **Red `!` badge?** Some rules were rejected by DNR (commonly RE2 lookarounds or invalid regex). The rest stay active; see the Service Worker console for details.
- **`cors` regex does not work?** `cors` uses `urlFilter`, not regex: a URL matches when it contains the pattern, and subdomains use `*.b.com`.
- **`withCredentials` requests are still blocked?** Manifest V3 can only inject a fixed `Access-Control-Allow-Origin: *`, which credential requests do not allow; use `proxy` to forward the request to a same-origin or local address.
- **Duplicate names when importing?** The dialog lets you overwrite, rename (with a timestamp suffix), or cancel.

## 📋 Changelog

### v2.5.0 (2026-10-28)

- ✨ **`headers` rules**: `["pattern", { "Header": "value" }]` injects or overrides request headers **without changing the URL** — useful for tagging and environment switching; browser-controlled headers such as `Host` and `Content-Length` are excluded.
- 🧩 **Global JS API** `window.xswitch`: manage groups and global switches from the DevTools console or automation tools (Playwright, browser MCP, etc.) on the `XSwitch.html` page, with full CRUD, group checkboxes, and state read/write. JSONC is validated before writing; invalid configs throw and are never persisted.
- 🚩 **Invalid group JSON is visible**: a red `!` appears next to the group name with the parse error on hover; that group is skipped while the rest keep working.
- 🗂 **`Current` now behaves like any other group**: it can be unchecked, dragged, pinned, renamed, and deleted; pinned groups all move to the top of the list.
- 🛡️ **One invalid rule no longer disables the whole batch**: when DNR rejects a rule (e.g. RE2-unsupported syntax), the extension retries in smaller groups, skips the invalid item, and keeps the rest active. A red `!` badge signals rejected rules, and the Service Worker console has the details.
- 🐛 Fixed the **badge lagging behind group check/uncheck**: the count now tracks active rules in real time.
- 📖 Added a bundled offline help page `docs/help.html`: full-page layout covering the UI, how to write `proxy` / `cors` / `headers` rules, complete examples, and an **interactive rule demo**, aligned with the actual Manifest V3 `declarativeNetRequest` semantics (full-URL regex matching, `cors` uses URL filters rather than regex, only one rule matched per request, etc.). A **Docs** button in the popup toolbar opens it directly.

### v2.4.0 (2026-09-09)

- 🔍 **Rule search**: the input box is now "Search or add" — type a keyword to filter rules in real time; when there is no match it hints "press Enter to add", with special handling for CJK IME composition to avoid accidental triggers.
- 📌 **Pin frequently used configs**: the rule kebab menu now offers "Pin to top / Unpin"; pinned items show a pin icon and move to the top of the list. Pinning only changes the **display order**, not the actual execution order of the rules.
- 🐛 Fixed **sidebar hover jitter** and removed redundant search spacing for a more stable list interaction.

### v2.3.0 (2026-07-29)

- ⚡️ **Performance refactor**: removed React 19 + Antd 6; the popup page is now implemented in vanilla JS, greatly reducing bundle size and improving first-paint and interaction responsiveness.
- ⚡️ **Lazy-loaded Monaco Editor**: the editor loads asynchronously on demand and no longer blocks first paint.
- ✅ Added E2E functional and performance tests covering all features, with V8 coverage statistics integrated.

### v2.2.0 (2026-06-12)

- ✨ **Config export**: export all rules to a JSON file in one click for backup and team sharing.
- ✨ **Config import**: import from a JSON file; when duplicate names exist, a dialog lets you choose **Overwrite / Rename / Cancel**. In rename mode a timestamp suffix is appended (e.g. `MyRule_20260612-180530`).
- 🎨 **Toolbar consolidation**: "Export / Import / Help docs" are grouped into the top-right "More" menu (`⋯` icon), supporting both hover and click triggers for a cleaner toolbar.

### v2.1.0

- 🐛 Fixed **delayed enable/disable state updates**; icon state and DNR rules stay in sync more accurately after toggling.

### v2.0.0

- ✨ Added rule **rename** (triggered from the hover kebab menu).
- ✨ Added rule **drag-to-sort** to freely adjust execution order; the `Current` item stays pinned on top.

## 📄 License

[MIT](https://opensource.org/licenses/MIT) © [yize.shc](https://www.yuque.com/jiushen)

---

[link-xswitch]: https://github.com/yize/xswitch
[link-cws]: https://chrome.google.com/webstore/detail/xswitch/idkjhjggpffolpidfkikidcokdkdaogg
[link-me]: https://github.com/Microsoft/monaco-editor
[link-travis]: https://travis-ci.org/yize/xswitch
[link-coverage]: https://coveralls.io/github/yize/xswitch?branch=master
[badge-travis]: https://travis-ci.org/yize/xswitch.svg?branch=master
[badge-coverage]: https://coveralls.io/repos/github/yize/xswitch/badge.svg?branch=master
[badge-license]: https://img.shields.io/github/license/yize/xswitch.svg
[badge-cws]: https://img.shields.io/chrome-web-store/v/idkjhjggpffolpidfkikidcokdkdaogg.svg?label=chrome
[badge-cws-count]: https://img.shields.io/chrome-web-store/users/idkjhjggpffolpidfkikidcokdkdaogg.svg

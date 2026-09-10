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
- Automatic **CORS** handling (with `withCredentials` support)
- One-click **browser cache disabling** to always load the latest resources
- **Global switch** to enable or disable all rules at any time

**🗂 Rule Management**

- **Rules grouping**: multiple config sets executed in the defined order
- 🔍 **Rule search** (v2.4.0): type to filter and quickly locate rules
- 📌 **Pin frequently used configs** (v2.4.0): pin high-frequency rules to the top of the list
- ✏️ **Rename / drag to sort**: adjust rules freely; the `Current` item stays on top
- 💾 **Import / export**: back up and share configs in one click

**⌨️ Editing Experience**

- Powered by **Monaco Editor** (same as VSCode), with [JSONC](https://komkom.github.io/) comment support
- Keyboard shortcuts, e.g. `⌘K` `⌘F` to format JSON
- Rule **auto-completion**

## 🚀 Usage

Rules are executed **from top to bottom in the order they are defined**. Even after a rule matches, matching continues downward until the last enabled rule.

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
    // 2) Global string replacement: replace every "alinw" with "g"
    ["alinw", "g"],
    // 3) Replace all ".min" with ""
    [".min", ""],
    // 4) Regex replacement: use $1, $2 to reference capture groups
    [
      "(.*)/platform/daily-test/(.*).js$",
      "http://127.0.0.1:3000/daily-test/$1.js"
    ],
    // 5) Inline JavaScript: return a snippet of JS directly
    [
      "https://alinw.alicdn.com/platform/daily-test/isDaily.js",
      "data:text/javascript,window.__isDaily = true;"
    ]
  ],
  // URLs that need CORS enabled
  "cors": [
    "cors.a.com",
    "(.*).b.com"
  ]
}
```

📖 More details: [XSwitch documentation](https://yuque.com/jiushen/blog/xswitch-readme)

## 📋 Changelog

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

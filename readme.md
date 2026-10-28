<div align="center">

<a href="https://chromewebstore.google.com/detail/xswitch-v3/dgocjnalnkkghhpdfgjinkhjigkggjdg?hl=zh-CN&utm_source=ext_sidebar">
  <img width="440" src="https://img.alicdn.com/tfs/TB1yll4lyqAXuNjy1XdXXaYcVXa-880-560.png" alt="XSwitch">
</a>

# XSwitch-v3

**一个安全、高效的 Chrome 请求转发插件，让本地开发更轻松愉快。**

[![Chrome Web Store][badge-cws]][link-cws] [![Users][badge-cws-count]][link-cws] [![License][badge-license]][link-xswitch]

**简体中文** ｜ [English](./readme.en_US.md)

</div>

---

## 📖 简介

XSwitch 是一款用于**重定向和转发 HTTP 请求 URL** 的 [Chrome 浏览器插件][link-cws]。它基于浏览器原生 `declarativeNetRequest` API（Manifest V3），安全性和性能都有保障，帮助开发者在本地开发时轻松地把线上资源代理到本地服务。

> 当前为 **v3** 版本，由 XSwitch 升级而来，已从 Manifest V2 全面迁移至 V3。

<div align="center">

[![XSwitch 介绍视频](https://cdn.nlark.com/yuque/0/2018/png/137701/1536999137086-9377abf2-ac97-4ccf-ae71-de178bf7238a.png)](https://www.youtube.com/watch?v=--gQM3ysCzc)

📺 [YouTube 视频介绍](https://www.youtube.com/watch?v=--gQM3ysCzc) ｜ [优酷视频介绍](https://v.youku.com/v_show/id_XMzgyNDgwODAwNA==.html)

</div>

## ✨ 功能特性

**🔀 请求转发**

- 支持**精确替换**、**正则匹配**、**inline JavaScript** 三种规则模式
- 支持**自定义请求头**：只注入 Header，不改变请求地址
- 自动处理 **CORS 跨域**：为命中请求注入 `Access-Control-Allow-Origin: *` 等响应头
- 一键**禁用浏览器缓存**，确保加载最新资源
- **全局启用开关**，随时启停所有规则

**🗂 规则管理**

- **分组规则**：多套配置勾选后按列表顺序合并编译
- 🔍 **规则搜索**（v2.4.0）：输入即筛选，快速定位规则
- 📌 **置顶常用配置**（v2.4.0）：高频规则一键 pin 到列表顶部
- ✏️ **重命名 / 拖动排序 / 删除**：自由调整规则，所有分组（含默认 `Current`）一视同仁
- 💾 **导入 / 导出**：配置一键备份与团队共享

**⌨️ 编辑体验**

- 基于 **Monaco Editor**（VSCode 同款），支持 [JSONC](https://komkom.github.io/) 注释
- 快捷键支持，如 `⌘K` `⌘F` 组合键格式化 JSON
- 规则**自动补全**

## 🚀 用法

每个分组是一段 JSONC 配置，保存后立即编译为浏览器 DNR 规则生效。**一个请求只会应用一条匹配规则**，不会链式改写；请让规则之间互斥，不要依赖多条规则接力。

> **小提示**：把 `HTTPS` 链接转发到 `http://127.0.0.1` 下，浏览器不会出现安全提示。习惯用 `localhost` 的同学不妨试试这个。

```js
{
  // 转发规则
  "proxy": [
    // 1) 精确替换：匹配一个 URL，替换成另一个 URL
    [
      "//alinw.alicdn.com/platform/daily-test/isDaily.js",
      "//alinw.alicdn.com/platform/daily-test/isDaily.json"
    ],
    // 2) 片段替换：捕获要保留的部分，再在目标里拼回
    ["(.*)alinw(.*)", "$1g$2"],
    // 3) 正则替换：用 $1、$2 引用捕获组
    [
      "(.*)/platform/daily-test/(.*).js",
      "http://127.0.0.1:3000/daily-test/$2.js"
    ],
    // 4) inline JavaScript：直接返回一段 JS 内容
    [
      "https://alinw.alicdn.com/platform/daily-test/isDaily.js",
      "data:text/javascript,window.__isDaily = true;"
    ]
  ],
  // 希望开启 CORS 跨域的链接
  "cors": [
    "cors.a.com",
    "*.b.com"
  ],
  // 只增加请求头，不改变请求地址（匹配模式为 RE2 正则）
  "headers": [
    [
      "https://api.example.com(/.*)?",
      { "X-Debug": "1", "X-Env": "local" }
    ]
  ]
}
```

`Host`、`Content-Length` 等浏览器保留的请求头无法修改。

### 规则字段与匹配方式

| 字段 | 作用 | 配置格式 | 匹配方式 |
| --- | --- | --- | --- |
| `proxy` | 改写请求 URL | `[["匹配模式", "替换目标"], ...]` | RE2 正则，默认不区分大小写 |
| `cors` | 注入跨域响应头 | `["URL 模式", ...]` | `urlFilter`：URL 包含即命中，`*` 通配，**不是正则** |
| `headers` | 注入/覆盖请求头，不改 URL | `[["匹配模式", { "头名": "值" }], ...]` | RE2 正则，默认不区分大小写 |

- `proxy` 的替换目标可用 `$1`、`$2` 引用捕获组，插件会自动转换成 DNR 的 `\1`、`\2`。目标会整串重建 URL，原 URL 中未被捕获组引用的部分不会保留。
- RE2 不支持 `(?=...)`、`(?<!...)` 等断言；被浏览器拒绝的规则会自动跳过，其余规则继续生效，图标角标显示红色 `!`，具体原因见 Service Worker 控制台。
- 适用资源类型：页面、XHR/fetch、脚本、样式表、图片、字体、其他；WebSocket 与媒体请求不适用。

### headers 请求头规则

`headers` 只注入或覆盖请求头，**不改变请求地址**，适合打标、切环境、让后端识别本地流量。

```js
"headers": [
  // 命中 api.example.com 下所有路径（含根路径）
  ["https://api.example.com(/.*)?", { "X-Env": "local", "X-Debug": "1" }],
  // 只命中某个目录
  ["https://api.example.com/v2/.*", { "X-Canary": "1" }]
]
```

- 同名请求头按**覆盖**（set）处理；头值可写数字或布尔，会自动转成字符串；值为 `null` 的项和空对象会被跳过。
- 与 `proxy` 一样使用 RE2 正则，默认不区分大小写；匹配模式要覆盖到路径，只写域名通常只能命中根路径。
- 与 `cors` 同时修改同一个响应头（如 `Access-Control-Allow-Origin`）时结果取决于浏览器，建议不要重叠。

### 界面与菜单

- **全局开关**：一键启停全部规则，关闭后图标变灰。
- **禁用缓存**：保存规则时自动清缓存，确保加载最新资源。
- **CORS 开关**：单独启停跨域改写，不影响转发规则。
- **规则列表**：搜索、勾选分组、Pin 置顶（仅调整展示顺序）、重命名、删除、拖拽排序；`Current` 只是默认分组，与其他分组完全一致。JSON 格式有误的分组名旁会显示红色 `!`，悬停可看具体原因。
- **更多菜单（⋯）**：导出配置、导入配置。
- **图标角标**：蓝色数字为生效的 `proxy` + `headers` 规则数；红色 `!` 表示有规则被浏览器拒绝，其余规则仍然生效。

📖 完整说明、规则语义与可交互 Demo：随插件内置的帮助页 [`docs/help.html`](./docs/help.html)（也可在弹出页点「Docs」打开）。旧版说明：[语雀文档](https://yuque.com/jiushen/blog/xswitch-readme)

### 在浏览器中通过 JS 操作配置（自动化 / Agent）

在新标签页打开 `chrome-extension://<插件ID>/XSwitch.html`，页面会暴露全局对象 `xswitch`。在 DevTools 控制台或自动化工具（Playwright、浏览器 MCP 等）中可直接调用；写入后会立即更新存储，由 Service Worker 重建 DNR 规则，页面列表与编辑器同步刷新。

| 方法 | 作用 |
| --- | --- |
| `xswitch.list()` | 列出全部分组，返回 `{ id, name, active, pinnedAt, jsonc, config, error }` |
| `xswitch.get(nameOrId)` | 查询单个分组，不存在返回 `null` |
| `xswitch.add(name, config)` | 新建分组，名称重复时报错 |
| `xswitch.set(nameOrId, config)` | 覆盖分组配置，接受对象或 JSONC 字符串 |
| `xswitch.remove(nameOrId)` | 删除分组并清理其配置 |
| `xswitch.setActive(nameOrId, active)` | 勾选 / 取消勾选分组 |
| `xswitch.getState()` | 读取全局开关 `{ enabled, clearCacheEnabled, corsEnabled }` |
| `xswitch.setState(patch)` | 修改全局开关，只更新传入的字段 |

```js
await xswitch.add('mock', { cors: ['m.api.com'] })
await xswitch.set('mock', { proxy: [['https://cdn.example.com/(.*)', 'http://localhost:3000/$1']] })
await xswitch.setActive('Current', false)
await xswitch.setState({ enabled: false, corsEnabled: false })
await xswitch.remove('mock')
```

- 分组实际生效需要 `active === true` 且 `getState().enabled === true`；`error` 非空表示该组 JSON 格式有误。
- `add` / `set` 先校验 JSONC，格式非法、分组不存在或名称重复都会直接抛错，不会写入存储。
- 请在新标签页打开该地址：工具栏弹出窗口失焦即关闭，脚本会随之中断。

## 🛠 本地开发

```bash
npm install        # 安装依赖
npm run dev        # 本地开发服务器（http://localhost:8088）
npm run build      # 构建到 build/（含 manifest、docs 与 Monaco）
npm test           # Jest 单元测试
npm run test:e2e   # Playwright 端到端测试（需先 build）
```

加载扩展：打开 `chrome://extensions`，开启「开发者模式」，点击「加载已解压的扩展程序」，选择 `build/` 目录。

```text
src/
├── pages/xswitch/    # 弹出页（main.ts 生产版，xswitch.tsx 开发版）
├── app.tsx           # 开发入口
├── background.ts     # Service Worker（DNR 规则、CORS）
├── forward.ts        # 请求转发逻辑
├── dnr-utils.ts      # DNR 规则生成
├── chrome-storage.ts # Storage 封装
└── constants.ts      # 常量与默认配置
docs/                 # 随插件分发的离线帮助页
```

## 🔐 权限与隐私

- `declarativeNetRequest` + `<all_urls>`：按你的规则改写请求和响应头。
- `storage`：保存规则与开关状态。
- `browsingData`：仅在开启「禁用缓存」时清理浏览器缓存。

XSwitch 不收集、不上传规则或浏览数据。

## ❓ 常见问题

- **规则保存后不生效？** 依次检查全局开关、分组是否勾选、分组名旁是否出现红色 `!`（该组 JSON 格式错误）、角标是否为红色 `!`，以及是否命中了浏览器缓存。
- **角标显示红色 `!`？** 有规则被 DNR 拒绝（常见于 RE2 不支持的断言或非法正则），其余规则仍然生效，具体原因见 Service Worker 控制台。
- **`cors` 写正则不生效？** `cors` 使用 `urlFilter` 而不是正则：URL 包含即命中，匹配子域请写 `*.b.com`。
- **`withCredentials` 请求仍被拦截？** Manifest V3 只能注入固定的 `Access-Control-Allow-Origin: *`，凭据请求不允许 `*`；请用 `proxy` 转发到同源或本地地址。
- **导入配置时重名？** 弹窗可选「覆盖导入」「重命名导入」（自动追加时间戳）或取消。

## 📋 更新记录

### v2.5.0 (2026-10-28)

- ✨ 新增 **headers 规则**：`["匹配模式", { "头名": "值" }]` 格式只注入/修改请求头，**不改变请求地址**，适合调试打标、环境切换；`Host`、`Content-Length` 等浏览器保留头除外。
- 🧩 新增 **全局 JS API** `window.xswitch`：在 `XSwitch.html` 页面上通过控制台或自动化工具（Playwright、浏览器 MCP 等）完成分组增删改查、勾选与全局开关读写；写入前校验 JSONC，非法配置直接报错且不落盘。
- 🚩 **分组 JSON 格式错误可见**：分组名旁显示红色 `!`，悬停可查看具体解析错误；该组不参与编译，其余分组不受影响。
- 🗂 **`Current` 与其它分组一视同仁**：可取消勾选、拖拽排序、置顶、重命名、删除；置顶分组统一排在列表最前。
- 🛡️ **非法规则不再拖垮整批规则**：单条规则被 DNR 拒绝（如正则使用了 RE2 不支持的语法）时，会自动分组重试、跳过非法项，其余规则继续生效；角标显示红色 `!` 提示有规则未生效，可在 Service Worker 控制台定位具体原因。
- 🐛 修复 **勾选/取消规则分组后角标状态滞后** 的问题，徽章数量与生效规则实时同步。
- 📖 新增随插件分发的离线帮助页 `docs/help.html`：覆盖界面操作、proxy/cors/headers 三类规则的编写方式、完整示例与**可交互的在线规则 Demo**，并按 Manifest V3 `declarativeNetRequest` 实际语义勘误（正则整条 URL 全匹配、cors 为 URL 模式非正则、单请求仅命中一条规则等）；弹出页工具栏新增 **「Docs」按钮**直接打开该页。

### v2.4.0 (2026-09-09)

- 🔍 新增 **规则搜索**：输入框改为「Search or add」，输入关键词即可实时筛选规则；无匹配时提示「回车新建」，并针对中文输入法组合态做了防误触处理。
- 📌 新增 **置顶常用配置**：规则三点菜单支持「Pin to top / Unpin」，置顶项显示图钉图标并排到列表前部；置顶仅调整**展示顺序**，不影响规则的实际执行顺序。
- 🐛 修复 **侧边栏 hover 抖动** 问题，并移除多余的搜索间距，列表交互更稳定。

### v2.3.0 (2026-07-29)

- ⚡️ **性能重构**：移除 React 19 + Antd 6，popup 页面改用原生 JS 实现，构建产物体积大幅缩小，首屏加载与交互响应显著提升。
- ⚡️ **Monaco 编辑器延迟加载**：编辑器按需异步加载，不再阻塞首屏渲染。
- ✅ 新增覆盖全部功能的 E2E 功能测试与性能测试，并集成 V8 覆盖率统计。

### v2.2.0 (2026-06-12)

- ✨ 新增 **配置导出** 功能：可将全部规则一键导出为 JSON 文件，便于备份与团队共享。
- ✨ 新增 **配置导入** 功能：选择 JSON 文件即可导入；当存在重名规则时，弹窗让用户在 **覆盖导入 / 重命名导入 / 取消** 之间选择，重命名模式下会在原名称后追加时间戳后缀（如 `MyRule_20260612-180530`）。
- 🎨 **工具栏整合**：将「导出配置 / 导入配置 / 帮助文档」统一收纳到右上角的「更多」菜单（`⋯` 图标），支持 hover 与点击两种触发方式，工具栏更简洁。

### v2.1.0

- 🐛 修复 **启用 / 禁用状态更新不及时** 的问题，开关切换后图标状态与 DNR 规则联动更准确。

### v2.0.0

- ✨ 新增规则项 **重命名** 功能（hover 三点菜单触发）。
- ✨ 新增规则项 **拖动排序** 功能，可自由调整规则执行顺序；`Current` 项固定置顶。

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

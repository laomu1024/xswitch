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

- 支持**字符串替换**、**正则匹配**、**inline JavaScript** 三种规则模式
- 自动处理 **CORS 跨域**（支持 `withCredentials`）
- 一键**禁用浏览器缓存**，确保加载最新资源
- **全局启用开关**，随时启停所有规则

**🗂 规则管理**

- **分组规则**：多套配置按定义顺序依次执行
- 🔍 **规则搜索**（v2.4.0）：输入即筛选，快速定位规则
- 📌 **置顶常用配置**（v2.4.0）：高频规则一键 pin 到列表顶部
- ✏️ **重命名 / 拖动排序**：自由调整规则，`Current` 项固定置顶
- 💾 **导入 / 导出**：配置一键备份与团队共享

**⌨️ 编辑体验**

- 基于 **Monaco Editor**（VSCode 同款），支持 [JSONC](https://komkom.github.io/) 注释
- 快捷键支持，如 `⌘K` `⌘F` 组合键格式化 JSON
- 规则**自动补全**

## 🚀 用法

规则会按定义顺序**从上到下依次执行**，即使已匹配到规则也会继续向下匹配，直到最后一条启用的规则。

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
    // 2) 全局字符串替换：把链接里所有的 alinw 替换成 g
    ["alinw", "g"],
    // 3) 正则替换：用 $1、$2 引用捕获组
    [
      "(.*)/platform/daily-test/(.*).js$",
      "http://127.0.0.1:3000/daily-test/$1.js"
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
    "(.*).b.com"
  ]
}
```

以前两条规则为例：访问 `https://alinw.alicdn.com/platform/daily-test/isDaily.js`，最终会被改写成 `https://g.alicdn.com/platform/daily-test/isDaily.json`。

📖 更多说明：[XSwitch 使用文档](https://yuque.com/jiushen/blog/xswitch-readme)

## 📋 更新记录

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

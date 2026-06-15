<p align="center">
  <a href="https://chromewebstore.google.com/detail/xswitch-v3/dgocjnalnkkghhpdfgjinkhjigkggjdg?hl=zh-CN&utm_source=ext_sidebar">
    <img width="440" src="https://img.alicdn.com/tfs/TB1yll4lyqAXuNjy1XdXXaYcVXa-880-560.png">
  </a>
</p>

[English](./readme.en_US.md)

## XSwitch-v3

从XSwitch升级过来

[![Chrome version][badge-cws]][link-cws] [![Chrome version][badge-cws-count]][link-cws] [![Build Status][badge-travis]][link-travis] [![Coverage Status][badge-coverage]][link-coverage] [![license][badge-license]][link-xswitch]

一个用来做请求链接转发的 [Chrome 浏览器插件][link-cws]，因为采用的是浏览器原生 `API`，安全性和性能能得到保障。

[![XSwitch-intro](https://cdn.nlark.com/yuque/0/2018/png/137701/1536999137086-9377abf2-ac97-4ccf-ae71-de178bf7238a.png)](https://www.youtube.com/watch?v=--gQM3ysCzc)

[优酷视频介绍](https://v.youku.com/v_show/id_XMzgyNDgwODAwNA==.html)

## 功能

- [x] 请求地址转发
- [x] 全局插件启用开关
- [x] 可禁用浏览器缓存
- [x] 采用 [jsonc](https://komkom.github.io/) 以支持在转发规则中写注释
- [x] 可以使用 Monaco Editor（VSCode）中的部分快捷键，比如通过 `⌘K` `⌘F` 组合键可以实现格式化 JSON 的功能 
- [x] 自动补全
- [x] 支持 CORS，支持 withCredentials
- [x] 跨域和缓存禁用键（右键点击浏览器工具栏的 XSwitch 插件图标 - 设置）
- [x] 分组规则

## 用法

所有的规则，会按照定义的顺序从前往后执行，即使匹配到了规则，也会继续往下匹配，直到最后一条启用的规则。

**小提示：把 `HTTPS` 的链接转发到 `http://127.0.0.1` 下，浏览器不会出安全提示。习惯用 `localhost` 的同学，可以尝试下这个。**

```js
{
  // 转发规则
  "proxy": [
    [
      "//alinw.alicdn.com/platform/daily-test/isDaily.js", // 匹配 URL
      "//alinw.alicdn.com/platform/daily-test/isDaily.json" // 替换成这个 URL
    ],
    // 字符串替换，会全局匹配
    [
      "alinw",
      "g"
    ]
    // 把链接里所有的 .min 替换掉
    // [
    //   ".min",
    //   ""
    // ],
    // 正则
    // [
    //   "(.*)/platform/daily-test/(.*).js$",
    //   "http://127.0.0.1:3000/daily-test/$1.js"
    // ],
    // 直接转换成 inline 模式的 JavaScript
    // [
    //   "https://alinw.alicdn.com/platform/daily-test/isDaily.js",
    //   "data:text/javascript,window.__isDaily = true;"
    // ]
  ],
  // 希望开启 CORS 跨域的链接
  "cors": [
    "cors.a.com",
    "(.*).b.com"
  ]
}
```

更多说明：[https://yuque.com/jiushen/blog/xswitch-readme](https://yuque.com/jiushen/blog/xswitch-readme)

- 访问 [https://alinw.alicdn.com/platform/daily-test/isDaily.js](https://alinw.alicdn.com/platform/daily-test/isDaily.js)
- 最终, 你的 URL 会被改写成 [https://<b>g.alicdn.com</b>/platform/daily-test/isDaily.<b>json</b>](https://g.alicdn.com/platform/daily-test/isDaily.json)

## License

[MIT](https://opensource.org/licenses/MIT) © [yize.shc](https://www.yuque.com/jiushen)

## 更新记录

### v2.2.0 (2026-06-12)

- ✨ 新增 **配置导出** 功能：可将全部规则一键导出为 JSON 文件，便于备份与团队共享。
- ✨ 新增 **配置导入** 功能：选择 JSON 文件即可导入；当存在重名规则时，弹窗让用户在 **覆盖导入 / 重命名导入 / 取消** 之间选择，重命名模式下会在原名称后追加时间戳后缀（如 `MyRule_20260612-180530`）。
- 🎨 **工具栏整合**：将"导出配置 / 导入配置 / 帮助文档"统一收纳到右上角的「更多」菜单（`⋯` 图标），支持 hover 与点击两种触发方式，工具栏更简洁。

### v2.1.0

- 🐛 修复 **启用 / 禁用状态更新不及时** 的问题，开关切换后图标状态与 DNR 规则联动更准确。

### v2.0.0

- ✨ 新增规则项 **重命名** 功能（hover 三点菜单触发）。
- ✨ 新增规则项 **拖动排序** 功能，可自由调整规则执行顺序；"Current" 项固定置顶。


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

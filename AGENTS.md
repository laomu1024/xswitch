# XSwitch 项目背景

## 开发规范

**重要**: 修改代码后务必执行 `npm run build` 进行编译，确保产物更新到 `build/` 目录，以便 Chrome 扩展加载最新代码。

## 项目概述

XSwitch 是一款 Chrome 浏览器扩展插件，用于安全高效地重定向和转发 HTTP 请求 URL。它帮助开发者在本地开发时轻松地将线上资源代理到本地服务，提升开发体验。

## 核心功能

- **URL 重定向**: 支持字符串替换、正则表达式匹配、inline JS 三种规则模式
- **CORS 跨域代理**: 自动处理跨域请求，修改响应头
- **浏览器缓存禁用**: 一键清除缓存，确保加载最新资源
- **JSONC 规则编辑**: 集成 Monaco Editor，支持带注释的 JSON 配置
- **规则分组管理**: 支持多组规则配置和顺序执行

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript |
| UI 组件 | Ant Design 6 + @ant-design/icons |
| 构建工具 | Rspack 2.0 |
| 代码编辑 | Monaco Editor |
| 扩展标准 | Chrome Manifest V3 |

## 项目结构

```
src/
├── pages/
│   ├── options/     # 选项页面（规则配置界面）
│   └── xswitch/     # 弹出页面（快速控制面板）
├── background.ts    # Service Worker（DNR 规则管理、CORS 处理）
├── forward.ts       # 请求转发核心逻辑
├── chrome-storage.ts # Chrome Storage 封装
├── constants.ts     # 常量定义
└── enums.ts         # 枚举定义
```

## 关键技术点

### Manifest V3 适配

项目已从 MV2 迁移到 MV3：
- `chrome.webRequest` 拦截逻辑迁移为 `chrome.declarativeNetRequest` (DNR) 规则
- `chrome.extension.getURL` 替换为 `chrome.runtime.getURL`
- Background 脚本改为 Service Worker 模式

### DNR 正则替换语法

DNR 的 `regexSubstitution` 使用 `\1`、`\2` 语法引用捕获组，而非 JavaScript 的 `$1`、`$2`。代码中已做自动转换：

```typescript
// 将用户配置的 $N 转换为 DNR 所需的 \N
const dnrTo = to.replace(/\$(\d+)/g, '\\$1');
```

## 开发命令

```bash
# 安装依赖
npm install

# 本地开发（启动 dev server）
npm run dev

# 构建生产版本
npm run build

# 运行测试
npm test
```

## 规则配置示例

```json
{
  "proxy": [
    ["https://cdn.example.com/lib/(.*)", "http://localhost:3000/lib/$1"],
    ["https://api.example.com", "http://localhost:8080"]
  ],
  "cors": [
    "https://api.example.com"
  ]
}
```

#!/bin/bash
set -e

# 移除旧包（若存在）
rm -f xswitch.zip

# 当前构建已不生成 .map，保留一行兼容语句
rm -f build/*.map

# 打包扩展
zip -r xswitch.zip build

# 打开 Chrome Web Store 开发者后台
open https://chrome.google.com/webstore/devconsole/g04040876578415358611/idkjhjggpffolpidfkikidcokdkdaogg/edit/package?hl=zh_CN

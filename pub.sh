#!/bin/bash
set -e

# 移除旧包（若存在）
rm -f xswitch.zip

# 当前构建已不生成 .map，保留一行兼容语句
rm -f build/*.map

# 打包扩展：进入 build 目录打包其内容，确保 manifest.json 位于 zip 根目录
# （Chrome Web Store 要求清单文件在压缩包根目录，多包一层 build/ 会导致上传失败）
(cd build && zip -r ../xswitch.zip .)

# 打开 Chrome Web Store 开发者后台
open https://chrome.google.com/webstore/devconsole/g04040876578415358611/idkjhjggpffolpidfkikidcokdkdaogg/edit/package?hl=zh_CN

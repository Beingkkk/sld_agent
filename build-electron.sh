#!/usr/bin/env bash
# 一键编译并打包 SLDAgent Electron 桌面端。
#
# 1. 安装 / 校验 npm 依赖
# 2. 清理上次构建产物
# 3. 构建所有 workspaces（core / frontend / backend / electron）
# 4. 调用 electron-builder 生成安装包 / 便携版
# 5. 产物输出到根目录 dist/（已加入 .gitignore，不提交）
#
# 用法：
#   chmod +x ./build-electron.sh
#   ./build-electron.sh

set -euo pipefail

cd "$(dirname "$0")"
ROOT="$(pwd)"

step() {
    echo ""
    echo "==> $1"
}

# 某些环境默认 dev=false，会导致 electron-builder 的嵌套 npm 裁剪 dev 依赖（如 7zip-bin）。
# 临时写入 .npmrc 强制 include=dev，脚本结束时恢复。
NPMRC="${ROOT}/.npmrc"
NPMRC_BACKUP="${NPMRC}.build-electron-bak"
if [ -f "$NPMRC" ]; then
    cp "$NPMRC" "$NPMRC_BACKUP"
fi
printf 'include=dev\n' > "$NPMRC"

cleanup_npmrc() {
    if [ -f "$NPMRC_BACKUP" ]; then
        mv "$NPMRC_BACKUP" "$NPMRC"
    else
        rm -f "$NPMRC"
    fi
}
trap cleanup_npmrc EXIT

step 'Installing dependencies (clean install from lockfile)...'
npm ci

step 'Cleaning previous build artifacts...'
rm -rf "${ROOT}/dist"
rm -rf "${ROOT}/SourceCode/frontend/dist"
rm -rf "${ROOT}/SourceCode/backend/dist"
rm -rf "${ROOT}/SourceCode/electron/dist"
rm -rf "${ROOT}/SourceCode/core/dist"
find "${ROOT}/SourceCode" -name 'tsconfig.tsbuildinfo' -type f -delete

step 'Building all workspaces...'
npm run build

step 'Packaging Electron app...'
cd "${ROOT}/SourceCode/electron"
ELECTRON_VERSION="$(node -p "require('../../node_modules/electron/package.json').version")"
npm exec -- electron-builder --config.electronVersion="${ELECTRON_VERSION}"
cd "$ROOT"

step 'Done. Packaged artifacts are in ./dist'

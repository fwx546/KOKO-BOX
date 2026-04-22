$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$node = Join-Path $root '.tools\node-v20.20.2-win-x64\node.exe'
$uni = Join-Path $root 'node_modules\@dcloudio\vite-plugin-uni\bin\uni.js'
$copyIcons = Join-Path $root 'scripts\copy-tab-icons.mjs'
$fixWechatConfig = Join-Path $root 'scripts\fix-wechat-output-config.mjs'

if (!(Test-Path $node)) {
  throw "Bundled Node runtime not found: $node"
}

if (!(Test-Path $uni)) {
  throw "uni build entry not found: $uni"
}

Push-Location $root
try {
  $env:UNI_INPUT_DIR = '.'
  & $node $uni build -p mp-weixin --outDir unpackage/dist/build/mp-weixin
  & $node $copyIcons
  & $node $fixWechatConfig
} finally {
  Pop-Location
}

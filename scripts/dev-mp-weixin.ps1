$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$node = Join-Path $root '.tools\node-v20.20.2-win-x64\node.exe'
$uni = Join-Path $root 'node_modules\@dcloudio\vite-plugin-uni\bin\uni.js'
$fixUniAlias = Join-Path $root 'scripts\fix-uni-cli-shared-alias.cjs'
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
  & $node $fixUniAlias
  if (Test-Path (Join-Path $root 'unpackage\dist\build\mp-weixin\project.config.json')) {
    & $node $fixWechatConfig
  }
  & $node $uni dev -p mp-weixin --outDir unpackage/dist/build/mp-weixin
} finally {
  Pop-Location
}

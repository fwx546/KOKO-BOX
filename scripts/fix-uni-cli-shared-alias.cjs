const fs = require('fs')
const path = require('path')

const root = process.cwd()
const aliasFile = path.join(root, 'node_modules', '@dcloudio', 'uni-cli-shared', 'dist', 'hbx', 'alias.js')
const marker = "path_1.default.resolve(path_1.default.dirname(require.resolve('@vue/shared')), 'dist/shared.esm-bundler.js')"
const search = "require.resolve('@vue/shared/dist/shared.esm-bundler.js')"

try {
  const source = fs.readFileSync(aliasFile, 'utf8')

  if (source.includes(marker)) {
    console.log('[fix-uni-cli-shared-alias] alias already patched.')
    process.exit(0)
  }

  if (!source.includes(search)) {
    throw new Error(`Could not find target import in ${aliasFile}`)
  }

  const next = source.replace(search, marker)
  fs.writeFileSync(aliasFile, next, 'utf8')
  console.log('[fix-uni-cli-shared-alias] Patched uni-cli-shared alias to avoid Vue package export resolution failure.')
} catch (error) {
  console.error('[fix-uni-cli-shared-alias] Failed:', error)
  process.exit(1)
}

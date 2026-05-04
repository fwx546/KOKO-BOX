import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const aliasFile = path.join(root, 'node_modules', '@dcloudio', 'uni-cli-shared', 'dist', 'hbx', 'alias.js')
const marker = "path.resolve(path.dirname(require.resolve('@vue/shared')), 'dist/shared.esm-bundler.js')"
const search = "require.resolve('@vue/shared/dist/shared.esm-bundler.js')"

const main = async () => {
  const source = await readFile(aliasFile, 'utf8')
  if (source.includes(marker)) {
    console.log('[fix-uni-cli-shared-alias] alias already patched.')
    return
  }

  if (!source.includes(search)) {
    throw new Error(`Could not find target import in ${aliasFile}`)
  }

  const next = source.replace(search, marker)
  await writeFile(aliasFile, next, 'utf8')
  console.log('[fix-uni-cli-shared-alias] Patched uni-cli-shared alias to avoid Vue package export resolution failure.')
}

main().catch((error) => {
  console.error('[fix-uni-cli-shared-alias] Failed:', error)
  process.exit(1)
})

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const outputRoot = path.join(root, 'unpackage', 'dist', 'build', 'mp-weixin')

const patchJsonFile = async (targetPath, patcher) => {
  const raw = await readFile(targetPath, 'utf8')
  const json = JSON.parse(raw)
  const next = patcher(json)
  await writeFile(targetPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
}

const main = async () => {
  await patchJsonFile(path.join(outputRoot, 'project.config.json'), (json) => ({
    ...json,
    miniprogramRoot: '',
    cloudfunctionRoot: 'cloudfunctions/',
  }))

  const privateConfig = path.join(outputRoot, 'project.private.config.json')
  await patchJsonFile(privateConfig, (json) => ({
    ...json,
  }))

  console.log('[fix-wechat-output-config] Patched output project.config.json for direct opening.')
}

main().catch((error) => {
  console.error('[fix-wechat-output-config] Failed:', error)
  process.exit(1)
})

import { existsSync } from 'node:fs'
import { cp, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const sourceRoot = path.join(root, 'dist', 'build', 'mp-weixin')
const outputRoot = path.join(root, 'unpackage', 'dist', 'build', 'mp-weixin')

const patchJsonFile = async (targetPath, patcher) => {
  const raw = await readFile(targetPath, 'utf8')
  const json = JSON.parse(raw)
  const next = patcher(json)
  await writeFile(targetPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
}

const patchJsonFileIfExists = async (targetPath, patcher) => {
  if (!existsSync(targetPath)) return false
  await patchJsonFile(targetPath, patcher)
  return true
}

const patchAppJson = async (targetRoot) => {
  await patchJsonFileIfExists(path.join(targetRoot, 'app.json'), (json) => ({
    ...json,
    lazyCodeLoading: 'requiredComponents',
  }))
}

const main = async () => {
  const sourceAppJson = path.join(sourceRoot, 'app.json')
  const outputAppJson = path.join(outputRoot, 'app.json')

  if (!existsSync(outputAppJson) && existsSync(sourceAppJson)) {
    await cp(sourceRoot, outputRoot, {
      recursive: true,
      force: true,
    })
    console.log('[fix-wechat-output-config] Synced full mp-weixin output into unpackage.')
  }

  await patchAppJson(sourceRoot)
  await patchAppJson(outputRoot)

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

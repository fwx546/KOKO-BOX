import { existsSync } from 'node:fs'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const sourceDir = path.join(root, 'static', 'tab')
const targetDir = path.join(root, 'unpackage', 'dist', 'build', 'mp-weixin', 'static', 'tab')
const manifestPath = path.join(root, 'tab-icons-base64.json')

async function writeEmbeddedIcons() {
  if (!existsSync(manifestPath)) {
    return
  }

  const rawManifest = await readFile(manifestPath, 'utf8')
  const icons = JSON.parse(rawManifest)

  await mkdir(targetDir, { recursive: true })
  await Promise.all(
    icons.map((icon) => writeFile(path.join(targetDir, icon.path), Buffer.from(icon.content, 'base64'))),
  )
}

async function main() {
  if (existsSync(sourceDir)) {
    await mkdir(targetDir, { recursive: true })
    await cp(sourceDir, targetDir, { recursive: true, force: true })
  }

  await writeEmbeddedIcons()
  console.log(`[copy-tab-icons] Prepared tab icons in ${targetDir}`)
}

main().catch((error) => {
  console.error('[copy-tab-icons] Failed to prepare tab icons:', error)
  process.exit(1)
})

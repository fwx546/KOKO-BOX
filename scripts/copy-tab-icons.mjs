import { existsSync } from 'node:fs'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const sourceTabDir = path.join(root, 'static', 'tab')
const sourcePetDir = path.join(root, 'static', 'pet')
const sourceTownDir = path.join(root, 'static', 'town')
const targetTabDir = path.join(root, 'unpackage', 'dist', 'build', 'mp-weixin', 'static', 'tab')
const targetPetDir = path.join(root, 'unpackage', 'dist', 'build', 'mp-weixin', 'static', 'pet')
const targetTownDir = path.join(root, 'unpackage', 'dist', 'build', 'mp-weixin', 'static', 'town')
const manifestPath = path.join(root, 'tab-icons-base64.json')

async function writeEmbeddedIcons() {
  if (!existsSync(manifestPath)) {
    return
  }

  const rawManifest = await readFile(manifestPath, 'utf8')
  const icons = JSON.parse(rawManifest)

  await mkdir(targetTabDir, { recursive: true })
  await Promise.all(
    icons.map((icon) => writeFile(path.join(targetTabDir, icon.path), Buffer.from(icon.content, 'base64'))),
  )
}

async function main() {
  // Copy tab icons
  if (existsSync(sourceTabDir)) {
    await mkdir(targetTabDir, { recursive: true })
    await cp(sourceTabDir, targetTabDir, { recursive: true, force: true })
  }

  // Copy pet assets
  if (existsSync(sourcePetDir)) {
    await mkdir(targetPetDir, { recursive: true })
    await cp(sourcePetDir, targetPetDir, { recursive: true, force: true })
  }

  // Copy town assets
  if (existsSync(sourceTownDir)) {
    await mkdir(targetTownDir, { recursive: true })
    await cp(sourceTownDir, targetTownDir, { recursive: true, force: true })
  }

  // Write embedded icons
  await writeEmbeddedIcons()
  console.log(`[copy-tab-icons] Prepared tab, pet, and town assets`)
}

main().catch((error) => {
  console.error('[copy-tab-icons] Failed to prepare assets:', error)
  process.exit(1)
})

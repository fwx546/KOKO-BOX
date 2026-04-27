import { existsSync } from 'node:fs'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const sourceTabDir = path.join(root, 'static', 'tab')
const sourcePetDir = path.join(root, 'static', 'pet')
const sourceTownDir = path.join(root, 'static', 'town')
const sourceHomeDir = path.join(root, 'static', 'home')
const candidateOutputRoots = [
  path.join(root, 'dist', 'build', 'mp-weixin'),
  path.join(root, 'unpackage', 'dist', 'build', 'mp-weixin'),
]
const manifestPath = path.join(root, 'tab-icons-base64.json')

function resolveOutputRoots() {
  const existingRoots = candidateOutputRoots.filter((outputRoot) => existsSync(outputRoot))
  if (existingRoots.length > 0) {
    return existingRoots
  }
  return [candidateOutputRoots[0]]
}

async function writeEmbeddedIcons(targetTabDir) {
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
  const outputRoots = resolveOutputRoots()

  for (const outputRoot of outputRoots) {
    const targetTabDir = path.join(outputRoot, 'static', 'tab')
    const targetPetDir = path.join(outputRoot, 'static', 'pet')
    const targetTownDir = path.join(outputRoot, 'static', 'town')
    const targetHomeDir = path.join(outputRoot, 'static', 'home')

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

    // Copy home assets
    if (existsSync(sourceHomeDir)) {
      await mkdir(targetHomeDir, { recursive: true })
      await cp(sourceHomeDir, targetHomeDir, { recursive: true, force: true })
    }

    // Write embedded icons
    await writeEmbeddedIcons(targetTabDir)
  }

  console.log(`[copy-tab-icons] Prepared tab, pet, town, and home assets for ${outputRoots.join(', ')}`)
}

main().catch((error) => {
  console.error('[copy-tab-icons] Failed to prepare assets:', error)
  process.exit(1)
})

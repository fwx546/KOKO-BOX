import { defineConfig } from 'vite'
import uniPlugin from '@dcloudio/vite-plugin-uni'

const createUniPlugin =
  typeof uniPlugin === 'function' ? uniPlugin : (uniPlugin as unknown as { default: () => unknown[] }).default

export default defineConfig({
  plugins: [...createUniPlugin()],
})

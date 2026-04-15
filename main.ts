import { createSSRApp } from 'vue'
import App from './App.vue'
import './src/styles/main.css'

export function createApp() {
  const app = createSSRApp(App)
  return {
    app,
  }
}

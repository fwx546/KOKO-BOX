import { createRouter, createWebHistory } from 'vue-router'
import HomePage from './pages/HomePage.vue'
import CarePage from './pages/CarePage.vue'
import ChatPage from './pages/ChatPage.vue'
import PlannerPage from './pages/PlannerPage.vue'
import StatsPage from './pages/StatsPage.vue'
import HardwarePage from './pages/HardwarePage.vue'
import ProfilePage from './pages/ProfilePage.vue'
import SettingsPage from './pages/SettingsPage.vue'

export const routes = [
  { path: '/', redirect: '/home' },
  { path: '/home', component: HomePage },
  { path: '/care', component: CarePage },
  { path: '/chat', component: ChatPage },
  { path: '/planner', component: PlannerPage },
  { path: '/stats', component: StatsPage },
  { path: '/hardware', component: HardwarePage },
  { path: '/profile', component: ProfilePage },
  { path: '/settings', component: SettingsPage },
] as const

const router = createRouter({
  history: createWebHistory(),
  routes: [...routes],
})

export default router

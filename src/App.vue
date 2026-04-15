<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLanguage } from './composables/useLanguage'
import HomePage from './pages/HomePage.vue'
import CarePage from './pages/CarePage.vue'
import ChatPage from './pages/ChatPage.vue'
import PlannerPage from './pages/PlannerPage.vue'
import StatsPage from './pages/StatsPage.vue'
import HardwarePage from './pages/HardwarePage.vue'
import ProfilePage from './pages/ProfilePage.vue'
import SettingsPage from './pages/SettingsPage.vue'

const { t, language, setLanguage } = useLanguage()

type PageId = 'home' | 'care' | 'chat' | 'planner' | 'stats' | 'hardware' | 'profile' | 'settings'

const currentPage = ref<PageId>('home')

const navItems = computed(() => [
  { id: 'home' as const, label: t.value.nav.home },
  { id: 'care' as const, label: t.value.nav.care },
  { id: 'chat' as const, label: t.value.nav.chat },
  { id: 'planner' as const, label: t.value.nav.planner },
  { id: 'stats' as const, label: t.value.nav.stats },
  { id: 'hardware' as const, label: t.value.nav.hardware },
  { id: 'profile' as const, label: t.value.nav.profile },
  { id: 'settings' as const, label: t.value.nav.settings },
])

const currentPageLabel = computed(() => navItems.value.find((item) => item.id === currentPage.value)?.label ?? t.value.nav.home)

const openPage = (pageId: PageId) => {
  currentPage.value = pageId
}
</script>

<template>
  <view class="page-shell">
    <view class="page-glow page-glow--left"></view>
    <view class="page-glow page-glow--right"></view>

    <view class="app-card">
      <view class="topbar">
        <view>
          <view class="eyebrow">{{ t.app.appName }}</view>
          <view class="h1-like">{{ t.app.headerTitle }}</view>
        </view>
        <view class="topbar__controls">
          <view class="language-switch">
            <button
              class="language-switch__button"
              :class="{ 'language-switch__button--active': language === 'zh' }"
              @click="setLanguage('zh')"
            >
              {{ t.app.langChinese }}
            </button>
            <button
              class="language-switch__button"
              :class="{ 'language-switch__button--active': language === 'en' }"
              @click="setLanguage('en')"
            >
              {{ t.app.langEnglish }}
            </button>
          </view>
          <view class="topbar__badge">{{ t.app.localBadge }}</view>
        </view>
      </view>

      <view class="nav-row">
        <button
          v-for="item in navItems"
          :key="item.id"
          class="nav-link"
          :class="{ 'nav-link--active': currentPage === item.id }"
          @click="openPage(item.id)"
        >
          {{ item.label }}
        </button>
      </view>

      <view class="view-container">
        <view class="current-page-label">{{ currentPageLabel }}</view>
        <HomePage v-if="currentPage === 'home'" />
        <CarePage v-else-if="currentPage === 'care'" />
        <ChatPage v-else-if="currentPage === 'chat'" />
        <PlannerPage v-else-if="currentPage === 'planner'" />
        <StatsPage v-else-if="currentPage === 'stats'" />
        <HardwarePage v-else-if="currentPage === 'hardware'" />
        <ProfilePage v-else-if="currentPage === 'profile'" />
        <SettingsPage v-else-if="currentPage === 'settings'" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useLanguage } from './composables/useLanguage'

const route = useRoute()
const { t, language, setLanguage } = useLanguage()

const navItems = computed(() => [
  { path: '/home', label: t.value.nav.home },
  { path: '/care', label: t.value.nav.care },
  { path: '/chat', label: t.value.nav.chat },
  { path: '/planner', label: t.value.nav.planner },
  { path: '/stats', label: t.value.nav.stats },
  { path: '/hardware', label: t.value.nav.hardware },
  { path: '/profile', label: t.value.nav.profile },
  { path: '/settings', label: t.value.nav.settings },
])

const currentPageLabel = computed(() => navItems.value.find((item) => item.path === route.path)?.label ?? t.value.nav.home)
</script>

<template>
  <div class="page-shell">
    <span class="page-glow page-glow--left"></span>
    <span class="page-glow page-glow--right"></span>

    <main class="app-card">
      <header class="topbar">
        <div>
          <p class="eyebrow">{{ t.app.appName }}</p>
          <h1>{{ t.app.headerTitle }}</h1>
        </div>
        <div class="topbar__controls">
          <div class="language-switch" :aria-label="t.app.languageLabel" role="group">
            <button
              class="language-switch__button"
              :class="{ 'language-switch__button--active': language === 'zh' }"
              type="button"
              @click="setLanguage('zh')"
            >
              {{ t.app.langChinese }}
            </button>
            <button
              class="language-switch__button"
              :class="{ 'language-switch__button--active': language === 'en' }"
              type="button"
              @click="setLanguage('en')"
            >
              {{ t.app.langEnglish }}
            </button>
          </div>
          <div class="topbar__badge">{{ t.app.localBadge }}</div>
        </div>
      </header>

      <nav class="nav-row" :aria-label="t.app.mainNavigationLabel">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-link"
          :class="{ 'nav-link--active': route.path === item.path }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="view-container">
        <p class="current-page-label">{{ currentPageLabel }}</p>
        <RouterView />
      </div>
    </main>
  </div>
</template>

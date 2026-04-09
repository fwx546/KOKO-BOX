<script setup lang="ts">
import { computed, ref } from 'vue'
import StatusCard from './components/StatusCard.vue'
import ReminderCard from './components/ReminderCard.vue'
import DeviceCard from './components/DeviceCard.vue'
import { copy, type Language, type SceneId, type StatKey } from './i18n'

const scenes = [
  {
    id: 'calm',
    accent: '#7ed9b5',
    glow: 'rgba(126, 217, 181, 0.28)',
  },
  {
    id: 'reset',
    accent: '#ffd37a',
    glow: 'rgba(255, 211, 122, 0.28)',
  },
  {
    id: 'hug',
    accent: '#ff9bb5',
    glow: 'rgba(255, 155, 181, 0.28)',
  },
] as const

const activeScene = ref<SceneId>('calm')
const language = ref<Language>('zh')

const setLanguage = (nextLanguage: Language) => {
  language.value = nextLanguage
}

const t = computed(() => copy[language.value])

const baseStats = {
  health: 86,
  mood: 78,
  hunger: 64,
  energy: 72,
  intimacy: 81,
  cleanliness: 90,
}

type StatItem = {
  key: StatKey
  label: string
  hint: string
  color: string
  value: number
}

const sceneAdjustments: Record<(typeof activeScene.value), Record<StatKey, number>> = {
  calm: { health: 2, mood: 4, hunger: -1, energy: 3, intimacy: 2, cleanliness: 1 },
  reset: { health: 0, mood: 2, hunger: -6, energy: -4, intimacy: 1, cleanliness: -1 },
  hug: { health: -2, mood: -8, hunger: -3, energy: -7, intimacy: 4, cleanliness: -2 },
}

const statColors = {
  health: 'var(--mint)',
  mood: 'var(--sun)',
  hunger: 'var(--peach)',
  energy: 'var(--sky)',
  intimacy: 'var(--rose)',
  cleanliness: 'var(--lime)',
} as const

const stats = computed<StatItem[]>(() => {
  const adjustment = sceneAdjustments[activeScene.value]
  const statText = t.value.stats
  return Object.entries(baseStats).map(([key, value]) => {
    const statKey = key as StatKey
    const nextValue = Math.min(100, Math.max(0, value + adjustment[statKey]))
    return {
      key: statKey,
      label: statText[statKey].label,
      hint: statText[statKey].hint,
      color: statColors[statKey],
      value: nextValue,
    }
  })
})

const currentScene = computed(() => {
  const selectedScene = scenes.find((scene) => scene.id === activeScene.value) ?? scenes[0]
  const sceneText = t.value.scenes[selectedScene.id]
  return {
    ...selectedScene,
    title: sceneText.title,
    subtitle: sceneText.subtitle,
    moodLine: sceneText.moodLine,
  }
})

const localizedScenes = computed(() =>
  scenes.map((scene) => ({
    ...scene,
    ...t.value.scenes[scene.id],
  })),
)

const reminders = computed(() => {
  const tones = ['sun', 'mint', 'peach'] as const
  return t.value.reminders.items.map((item, index) => ({
    ...item,
    tone: tones[index],
  }))
})

const devices = computed(() => {
  const accents = ['#7ed9b5', '#ffd37a', '#ff9bb5'] as const
  return t.value.hardware.devices.map((device, index) => ({
    ...device,
    accent: accents[index],
  }))
})

const growthProgress = computed(() => {
  const moodValue = stats.value.find((item: StatItem) => item.key === 'mood')?.value ?? 0
  const intimacyValue = stats.value.find((item: StatItem) => item.key === 'intimacy')?.value ?? 0
  return Math.round((moodValue + intimacyValue + 70) / 3)
})
</script>

<template>
  <div class="page-shell">
    <span class="page-glow page-glow--left"></span>
    <span class="page-glow page-glow--right"></span>

    <main class="app-card">
      <header class="topbar">
        <div>
          <p class="eyebrow">{{ t.meta.appName }}</p>
          <h1>{{ t.meta.headerTitle }}</h1>
        </div>
        <div class="topbar__controls">
          <div class="language-switch" :aria-label="t.meta.languageLabel" role="group">
            <button
              class="language-switch__button"
              :class="{ 'language-switch__button--active': language === 'zh' }"
              type="button"
              @click="setLanguage('zh')"
            >
              {{ t.meta.langChinese }}
            </button>
            <button
              class="language-switch__button"
              :class="{ 'language-switch__button--active': language === 'en' }"
              type="button"
              @click="setLanguage('en')"
            >
              {{ t.meta.langEnglish }}
            </button>
          </div>
          <div class="topbar__badge">{{ t.meta.localBadge }}</div>
        </div>
      </header>

      <section class="scene-strip">
        <button
          v-for="scene in localizedScenes"
          :key="scene.id"
          class="scene-pill"
          :class="{ 'scene-pill--active': scene.id === activeScene }"
          @click="activeScene = scene.id"
        >
          <span class="scene-pill__dot" :style="{ background: scene.accent, boxShadow: `0 0 0 10px ${scene.glow}` }"></span>
          <span>
            <strong>{{ scene.title }}</strong>
            <small>{{ scene.subtitle }}</small>
          </span>
        </button>
      </section>

      <section class="hero-grid">
        <article class="hero-card" :style="{ '--hero-accent': currentScene.accent, '--hero-glow': currentScene.glow }">
          <div class="hero-card__orb hero-card__orb--one"></div>
          <div class="hero-card__orb hero-card__orb--two"></div>
          <div class="pet-figure">
            <div class="pet-figure__ear pet-figure__ear--left"></div>
            <div class="pet-figure__ear pet-figure__ear--right"></div>
            <div class="pet-figure__face">
              <span class="pet-figure__eye"></span>
              <span class="pet-figure__eye"></span>
              <span class="pet-figure__mouth"></span>
            </div>
          </div>
          <div class="hero-copy">
            <p class="eyebrow">{{ t.hero.eyebrow }}</p>
            <h2>{{ currentScene.title }}</h2>
            <p>{{ currentScene.moodLine }}</p>
          </div>
          <div class="hero-actions">
            <button class="primary-action">{{ t.hero.actionHello }}</button>
            <button class="secondary-action">{{ t.hero.actionReminder }}</button>
          </div>
        </article>

        <aside class="summary-card">
          <p class="eyebrow">{{ t.summary.eyebrow }}</p>
          <div class="summary-card__metric">
            <span>{{ growthProgress }}%</span>
            <strong>{{ t.summary.growthTitle }}</strong>
            <small>{{ t.summary.growthHint }}</small>
          </div>
          <div class="summary-card__list">
            <div>
              <span>{{ t.summary.syncLabel }}</span>
              <strong>{{ t.summary.syncValue }}</strong>
            </div>
            <div>
              <span>{{ t.summary.reminderLabel }}</span>
              <strong>{{ t.summary.reminderValue }}</strong>
            </div>
            <div>
              <span>{{ t.summary.aiLabel }}</span>
              <strong>{{ t.summary.aiValue }}</strong>
            </div>
          </div>
        </aside>
      </section>

      <section class="content-grid">
        <div class="content-grid__left">
          <div class="section-head">
            <div>
              <p class="eyebrow">{{ t.petAttributes.eyebrow }}</p>
              <h3>{{ t.petAttributes.title }}</h3>
            </div>
            <span class="section-head__note">{{ t.petAttributes.note }}</span>
          </div>

          <div class="stats-grid">
            <StatusCard
              v-for="item in stats"
              :key="item.key"
              :label="item.label"
              :value="item.value"
              :hint="item.hint"
              :color="item.color"
            />
          </div>

          <article class="growth-panel">
            <div>
              <p class="eyebrow">{{ t.growth.eyebrow }}</p>
              <h3>{{ t.growth.title }}</h3>
              <p>{{ t.growth.description }}</p>
            </div>
            <div class="growth-panel__meter">
              <div class="growth-panel__ring" :style="{ '--ring-progress': growthProgress }">
                <span>{{ growthProgress }}%</span>
              </div>
              <small>{{ t.growth.progress }}</small>
            </div>
          </article>
        </div>

        <div class="content-grid__right">
          <div class="panel-block">
            <div class="section-head section-head--compact">
              <div>
                <p class="eyebrow">{{ t.reminders.eyebrow }}</p>
                <h3>{{ t.reminders.title }}</h3>
              </div>
            </div>
            <div class="reminder-list">
              <ReminderCard
                v-for="item in reminders"
                :key="`${item.title}-${item.badge}`"
                :title="item.title"
                :subtitle="item.subtitle"
                :tone="item.tone"
                :badge="item.badge"
              />
            </div>
          </div>

          <div class="panel-block">
            <div class="section-head section-head--compact">
              <div>
                <p class="eyebrow">{{ t.hardware.eyebrow }}</p>
                <h3>{{ t.hardware.title }}</h3>
              </div>
            </div>
            <div class="device-list">
              <DeviceCard
                v-for="device in devices"
                :key="device.name"
                :name="device.name"
                :status="device.status"
                :detail="device.detail"
                :accent="device.accent"
              />
            </div>
          </div>

          <article class="chat-panel">
            <div class="section-head section-head--compact">
              <div>
                <p class="eyebrow">{{ t.chat.eyebrow }}</p>
                <h3>{{ t.chat.title }}</h3>
              </div>
            </div>
            <div class="chat-panel__bubble chat-panel__bubble--assistant">
              <strong>{{ t.chat.assistantName }}</strong>
              <p>{{ t.chat.assistantText }}</p>
            </div>
            <div class="chat-panel__bubble chat-panel__bubble--user">
              <strong>{{ t.chat.userName }}</strong>
              <p>{{ t.chat.userText }}</p>
            </div>
            <div class="chat-panel__input">
              <span>{{ t.chat.inputPlaceholder }}</span>
              <button>{{ t.chat.send }}</button>
            </div>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>

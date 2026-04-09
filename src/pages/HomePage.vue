<script setup lang="ts">
import { computed, ref } from 'vue'
import StatusCard from '../components/StatusCard.vue'
import ReminderCard from '../components/ReminderCard.vue'
import { useLanguage } from '../composables/useLanguage'
import type { SceneId, StatKey } from '../i18n'

const { t } = useLanguage()

const scenes = [
  { id: 'calm', accent: '#7ed9b5', glow: 'rgba(126, 217, 181, 0.28)' },
  { id: 'reset', accent: '#ffd37a', glow: 'rgba(255, 211, 122, 0.28)' },
  { id: 'hug', accent: '#ff9bb5', glow: 'rgba(255, 155, 181, 0.28)' },
] as const

const activeScene = ref<SceneId>('calm')

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

const statColors = {
  health: 'var(--mint)',
  mood: 'var(--sun)',
  hunger: 'var(--peach)',
  energy: 'var(--sky)',
  intimacy: 'var(--rose)',
  cleanliness: 'var(--lime)',
} as const

const sceneAdjustments: Record<SceneId, Record<StatKey, number>> = {
  calm: { health: 2, mood: 4, hunger: -1, energy: 3, intimacy: 2, cleanliness: 1 },
  reset: { health: 0, mood: 2, hunger: -6, energy: -4, intimacy: 1, cleanliness: -1 },
  hug: { health: -2, mood: -8, hunger: -3, energy: -7, intimacy: 4, cleanliness: -2 },
}

const localizedScenes = computed(() =>
  scenes.map((scene) => ({
    ...scene,
    ...t.value.home.scenes[scene.id],
  })),
)

const currentScene = computed(() => localizedScenes.value.find((scene) => scene.id === activeScene.value) ?? localizedScenes.value[0])

const stats = computed<StatItem[]>(() => {
  const adjustment = sceneAdjustments[activeScene.value]
  const statText = t.value.stats
  return Object.entries(baseStats).map(([key, value]) => {
    const statKey = key as StatKey
    return {
      key: statKey,
      label: statText[statKey].label,
      hint: statText[statKey].hint,
      color: statColors[statKey],
      value: Math.min(100, Math.max(0, value + adjustment[statKey])),
    }
  })
})

const growthProgress = computed(() => {
  const moodValue = stats.value.find((item) => item.key === 'mood')?.value ?? 0
  const intimacyValue = stats.value.find((item) => item.key === 'intimacy')?.value ?? 0
  return Math.round((moodValue + intimacyValue + 70) / 3)
})

const reminders = computed(() => {
  const tones = ['sun', 'mint', 'peach'] as const
  return t.value.home.recentReminders.map((item, index) => ({
    ...item,
    tone: tones[index % tones.length],
  }))
})
</script>

<template>
  <div class="page-view">
    <header class="page-head">
      <div>
        <p class="eyebrow">{{ t.home.eyebrow }}</p>
        <h2>{{ t.home.title }}</h2>
      </div>
      <p>{{ t.home.subtitle }}</p>
    </header>

    <div class="page-home-grid">
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
          <p class="eyebrow">{{ t.home.petDisplayLabel }}</p>
          <h3>{{ currentScene.title }}</h3>
          <p>{{ currentScene.moodLine }}</p>
        </div>

        <div class="scene-strip scene-strip--compact">
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
        </div>
      </article>

      <article class="summary-card">
        <p class="eyebrow">{{ t.home.statusOverviewLabel }}</p>
        <div class="summary-card__metric">
          <span>{{ growthProgress }}%</span>
          <strong>{{ t.home.growthTitle }}</strong>
          <small>{{ t.home.growthHint }}</small>
        </div>
        <div class="summary-card__list">
          <div v-for="item in t.home.statusSummary" :key="item.label">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
      </article>

      <section class="panel-block">
        <div class="section-head section-head--compact">
          <div>
            <p class="eyebrow">{{ t.home.todayTodoLabel }}</p>
            <h3>{{ t.home.todoTitle }}</h3>
          </div>
        </div>
        <ul class="simple-list">
          <li v-for="todo in t.home.todayTodos" :key="todo.title">
            <span>{{ todo.title }}</span>
            <strong>{{ todo.time }}</strong>
          </li>
        </ul>
      </section>

      <section class="panel-block">
        <div class="section-head section-head--compact">
          <div>
            <p class="eyebrow">{{ t.home.recentReminderLabel }}</p>
            <h3>{{ t.home.recentReminderTitle }}</h3>
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
      </section>

      <section class="panel-block panel-block--full">
        <div class="section-head section-head--compact">
          <div>
            <p class="eyebrow">{{ t.home.quickActionLabel }}</p>
            <h3>{{ t.home.quickActionTitle }}</h3>
          </div>
        </div>
        <div class="quick-action-grid">
          <button v-for="action in t.home.quickActions" :key="action" class="quick-action-button">{{ action }}</button>
        </div>
      </section>

      <section class="panel-block panel-block--full">
        <div class="section-head section-head--compact">
          <div>
            <p class="eyebrow">{{ t.home.attributeLabel }}</p>
            <h3>{{ t.home.attributeTitle }}</h3>
          </div>
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
      </section>
    </div>
  </div>
</template>

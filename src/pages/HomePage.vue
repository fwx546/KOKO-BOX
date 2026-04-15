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
  <view class="page-view">
    <view class="page-head">
      <view>
        <view class="eyebrow">{{ t.home.eyebrow }}</view>
        <view>{{ t.home.title }}</view>
      </view>
      <view>{{ t.home.subtitle }}</view>
    </view>

    <view class="page-home-grid">
      <view class="hero-card" :style="{ '--hero-accent': currentScene.accent, '--hero-glow': currentScene.glow }">
        <view class="hero-card__orb hero-card__orb--one"></view>
        <view class="hero-card__orb hero-card__orb--two"></view>

        <view class="pet-figure">
          <view class="pet-figure__ear pet-figure__ear--left"></view>
          <view class="pet-figure__ear pet-figure__ear--right"></view>
          <view class="pet-figure__face">
            <view class="pet-figure__eye"></view>
            <view class="pet-figure__eye"></view>
            <view class="pet-figure__mouth"></view>
          </view>
        </view>

        <view class="hero-copy">
          <view class="eyebrow">{{ t.home.petDisplayLabel }}</view>
          <view>{{ currentScene.title }}</view>
          <view>{{ currentScene.moodLine }}</view>
        </view>

        <view class="scene-strip scene-strip--compact">
          <button
            v-for="scene in localizedScenes"
            :key="scene.id"
            class="scene-pill"
            :class="{ 'scene-pill--active': scene.id === activeScene }"
            @click="activeScene = scene.id"
          >
            <view class="scene-pill__dot" :style="{ background: scene.accent, boxShadow: `0 0 0 10px ${scene.glow}` }"></view>
            <view>
              <view>{{ scene.title }}</view>
              <view>{{ scene.subtitle }}</view>
            </view>
          </button>
        </view>
      </view>

      <view class="summary-card">
        <view class="eyebrow">{{ t.home.statusOverviewLabel }}</view>
        <view class="summary-card__metric">
          <view>{{ growthProgress }}%</view>
          <view>{{ t.home.growthTitle }}</view>
          <view>{{ t.home.growthHint }}</view>
        </view>
        <view class="summary-card__list">
          <view v-for="item in t.home.statusSummary" :key="item.label">
            <view>{{ item.label }}</view>
            <view>{{ item.value }}</view>
          </view>
        </view>
      </view>

      <view class="panel-block">
        <view class="section-head section-head--compact">
          <view>
            <view class="eyebrow">{{ t.home.todayTodoLabel }}</view>
            <view>{{ t.home.todoTitle }}</view>
          </view>
        </view>
        <view class="simple-list">
          <view v-for="todo in t.home.todayTodos" :key="todo.title">
            <view>{{ todo.title }}</view>
            <view>{{ todo.time }}</view>
          </view>
        </view>
      </view>

      <view class="panel-block">
        <view class="section-head section-head--compact">
          <view>
            <view class="eyebrow">{{ t.home.recentReminderLabel }}</view>
            <view>{{ t.home.recentReminderTitle }}</view>
          </view>
        </view>
        <view class="reminder-list">
          <ReminderCard
            v-for="item in reminders"
            :key="`${item.title}-${item.badge}`"
            :title="item.title"
            :subtitle="item.subtitle"
            :tone="item.tone"
            :badge="item.badge"
          />
        </view>
      </view>

      <view class="panel-block panel-block--full">
        <view class="section-head section-head--compact">
          <view>
            <view class="eyebrow">{{ t.home.quickActionLabel }}</view>
            <view>{{ t.home.quickActionTitle }}</view>
          </view>
        </view>
        <view class="quick-action-grid">
          <button v-for="action in t.home.quickActions" :key="action" class="quick-action-button">{{ action }}</button>
        </view>
      </view>

      <view class="panel-block panel-block--full">
        <view class="section-head section-head--compact">
          <view>
            <view class="eyebrow">{{ t.home.attributeLabel }}</view>
            <view>{{ t.home.attributeTitle }}</view>
          </view>
        </view>
        <view class="stats-grid">
          <StatusCard
            v-for="item in stats"
            :key="item.key"
            :label="item.label"
            :value="item.value"
            :hint="item.hint"
            :color="item.color"
          />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import StatusCard from '../components/StatusCard.vue'
import ReminderCard from '../components/ReminderCard.vue'
import { useLanguage } from '../composables/useLanguage'
import type { StatKey } from '../i18n'

const { t } = useLanguage()

const baseStats: Record<StatKey, number> = {
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

const currentScene = computed(() => t.value.home.scenes.calm)

const stats = computed<StatItem[]>(() => {
  const statText = t.value.stats
  return Object.entries(baseStats).map(([key, value]) => {
    const statKey = key as StatKey
    return {
      key: statKey,
      label: statText[statKey].label,
      hint: statText[statKey].hint,
      color: statColors[statKey],
      value,
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
      <view class="hero-card">
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

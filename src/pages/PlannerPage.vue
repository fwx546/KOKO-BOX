<script setup lang="ts">
import { computed, ref } from 'vue'
import PetLottieAvatar from '../components/PetLottieAvatar.vue'
import { useKokoState } from '../composables/useKokoState'
import type { Task, TaskCategory } from '../types/koko'

const { todayTasks, completedTasks, pet, setTaskStatus } = useKokoState()

type HabitTaskCard = Task & {
  accent: string
  categoryIcon: string
  categoryLabel: string
  streakDays: string
}

const encouragements = [
  '先完成一个小目标就很棒啦',
  '我在旁边陪你打卡',
  '今天也慢慢来，稳稳完成',
  '完成一件小事，也是很厉害的前进',
  '你点一下，我就给你加油一下',
]

const categoryMeta: Record<TaskCategory, { icon: string; label: string }> = {
  schedule: { icon: '⏰', label: '日程' },
  study: { icon: '✏️', label: '学习' },
  work: { icon: '📌', label: '工作' },
  health: { icon: '🌿', label: '健康' },
  life: { icon: '🏠', label: '生活' },
}

const accentClasses = ['lavender', 'mint', 'sun', 'rose', 'sky', 'peach']
const petMessage = ref(encouragements[0])
const petTapCount = ref(0)

const openCreatePage = () => {
  uni.navigateTo({ url: '/pages/planner-create/index' })
}

const openTask = (taskId: string) => {
  uni.navigateTo({ url: `/pages/planner-task/index?id=${taskId}` })
}

const formatStreakDays = (createdAt?: string) => {
  const createdMs = createdAt ? new Date(createdAt).getTime() : Number.NaN
  if (!Number.isFinite(createdMs)) return '01'

  const days = Math.max(1, Math.ceil((Date.now() - createdMs) / 86400000))
  return String(days).padStart(2, '0')
}

const toHabitCard = (task: Task, index: number): HabitTaskCard => {
  const meta = categoryMeta[task.category] ?? categoryMeta.life

  return {
    ...task,
    accent: accentClasses[index % accentClasses.length],
    categoryIcon: meta.icon,
    categoryLabel: meta.label,
    streakDays: formatStreakDays(task.createdAt),
  }
}

const pendingCards = computed(() => todayTasks.value.map(toHabitCard))
const doneCards = computed(() => completedTasks.value.map(toHabitCard))
const visiblePendingCards = computed(() => pendingCards.value.slice(0, 4))
const visibleDoneCards = computed(() => doneCards.value.slice(0, 4))
const completedCount = computed(() => doneCards.value.length)
const totalCount = computed(() => pendingCards.value.length + doneCards.value.length)

const completeTask = (taskId: string) => {
  setTaskStatus(taskId, 'completed')
  petMessage.value = '打卡成功！奖励已经送给小宠物啦'
}

const cheerPet = () => {
  const nextIndex = Math.floor(Math.random() * encouragements.length)
  petMessage.value = encouragements[nextIndex]
  petTapCount.value += 1
}
</script>

<template>
  <view class="planner-punch-page">
    <view class="planner-punch-board">
      <view class="planner-punch-board__head">
        <view>
          <view class="planner-punch-board__title">今日打卡</view>
          <view class="planner-punch-board__meta">已完成 {{ completedCount }} / {{ totalCount }}</view>
        </view>
        <button class="planner-punch-create" @click="openCreatePage">新建</button>
      </view>

      <view class="planner-punch-section">
        <view class="planner-punch-section__title">今日未完成</view>
        <view v-if="visiblePendingCards.length" class="planner-punch-grid planner-punch-grid--pending">
          <view
            v-for="task in visiblePendingCards"
            :key="task.id"
            class="planner-punch-card"
            :class="`planner-punch-card--${task.accent}`"
            @click="openTask(task.id)"
          >
            <view class="planner-punch-card__top">
              <view>坚持 <text>{{ task.streakDays }}</text> 天</view>
              <button class="planner-punch-check" @click.stop="completeTask(task.id)" aria-label="完成打卡" />
            </view>
            <view class="planner-punch-card__body">
              <view class="planner-punch-card__icon">{{ task.categoryIcon }}</view>
              <view class="planner-punch-card__title">{{ task.title }}</view>
            </view>
            <view class="planner-punch-card__meta">{{ task.time }} · {{ task.categoryLabel }}</view>
          </view>
        </view>
        <view v-else class="planner-punch-empty">今天的未完成已经清空啦，可以休息一下，或者给明天加一个小目标。</view>
      </view>

      <view class="planner-punch-pet-zone">
        <view class="planner-punch-pet-bubble" :key="petMessage">{{ petMessage }}</view>
        <button class="planner-punch-pet" :class="{ 'planner-punch-pet--tap': petTapCount % 2 === 1 }" @click="cheerPet">
          <PetLottieAvatar :size-rpx="210" />
        </button>
      </view>

      <view class="planner-punch-section">
        <view class="planner-punch-section__title">今日已完成</view>
        <view v-if="visibleDoneCards.length" class="planner-punch-grid">
          <view
            v-for="task in visibleDoneCards"
            :key="task.id"
            class="planner-punch-card planner-punch-card--done"
            :class="`planner-punch-card--${task.accent}`"
            @click="openTask(task.id)"
          >
            <view class="planner-punch-card__top">
              <view>坚持 <text>{{ task.streakDays }}</text> 天</view>
              <view class="planner-punch-done-mark">✓</view>
            </view>
            <view class="planner-punch-card__body">
              <view class="planner-punch-card__icon">{{ task.categoryIcon }}</view>
              <view class="planner-punch-card__title">{{ task.title }}</view>
            </view>
            <view class="planner-punch-card__meta">{{ task.time }} · {{ task.categoryLabel }}</view>
          </view>
        </view>
        <view v-else class="planner-punch-empty">先从一个小目标开始，完成后它会来到这里。</view>
      </view>
    </view>
  </view>
</template>

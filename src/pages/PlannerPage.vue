<script setup lang="ts">
import { computed, ref } from 'vue'
import ReminderCard from '../components/ReminderCard.vue'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'
import type { RewardType, TaskCategory, TaskRepeatType } from '../types/koko'

const { t } = useLanguage()
const { tasks, recentReminders, createTask, setTaskStatus } = useKokoState()

const taskTitle = ref('')
const taskTime = ref('09:00')
const selectedCategory = ref<TaskCategory>('schedule')
const selectedRepeat = ref<TaskRepeatType>('once')
const selectedReward = ref<RewardType>('mood')

const categories: Array<{ value: TaskCategory; label: string }> = [
  { value: 'schedule', label: '作息' },
  { value: 'study', label: '学习' },
  { value: 'work', label: '工作' },
  { value: 'health', label: '健康' },
  { value: 'life', label: '生活' },
]

const repeats: Array<{ value: TaskRepeatType; label: string }> = [
  { value: 'once', label: '单次' },
  { value: 'daily', label: '每日' },
  { value: 'weekly', label: '每周' },
]

const rewards: Array<{ value: RewardType; label: string }> = [
  { value: 'mood', label: '心情提升' },
  { value: 'bond', label: '亲密奖励' },
  { value: 'snack', label: '零食奖励' },
  { value: 'coin', label: '金币奖励' },
]

const orderedTasks = computed(() =>
  [...tasks.value].sort((left, right) => {
    if (left.status === right.status) {
      return left.time.localeCompare(right.time)
    }

    return left.status === 'pending' ? -1 : 1
  }),
)

const createNewTask = () => {
  if (!taskTitle.value.trim()) {
    return
  }

  createTask({
    title: taskTitle.value.trim(),
    time: taskTime.value,
    category: selectedCategory.value,
    repeatType: selectedRepeat.value,
    rewardType: selectedReward.value,
  })

  taskTitle.value = ''
}
</script>

<template>
  <view class="page-view">
    <view class="page-head">
      <view>
        <view class="eyebrow">时间安排</view>
        <view>今日代办</view>
      </view>
      <view>优先处理今天最重要的事项，并关注最近提醒。</view>
    </view>

    <view class="page-grid-2">
      <view class="panel-block">
        <view class="eyebrow">最近提醒</view>
        <view>任务与联动提醒</view>
        <view class="reminder-list">
          <ReminderCard
            v-for="item in recentReminders"
            :key="item.id"
            :title="item.title"
            :subtitle="item.subtitle"
            :badge="item.badge"
            :tone="item.tone"
          />
        </view>
      </view>

      <view class="panel-block panel-block--full">
        <view class="eyebrow">今日代办</view>
        <view>待办列表与进度更新</view>
        <view class="task-list">
          <view v-for="task in orderedTasks" :key="task.id" class="task-card">
            <view class="task-card__head">
              <view>
                <view class="task-card__title">{{ task.title }}</view>
                <view class="task-card__meta">{{ task.time }} · {{ task.category }} · {{ task.rewardType }}</view>
              </view>
              <view class="task-card__status">{{ task.status }}</view>
            </view>
            <view class="pill-row">
              <button class="profile-shortcut-button" @click="setTaskStatus(task.id, 'completed')">完成</button>
              <button class="profile-shortcut-button" @click="setTaskStatus(task.id, 'delayed')">延期</button>
              <button class="profile-shortcut-button" @click="setTaskStatus(task.id, 'skipped')">跳过</button>
            </view>
          </view>
        </view>
      </view>

      <view class="panel-block panel-block--full">
        <view class="eyebrow">新增代办</view>
        <view>快速创建今日任务</view>
        <view class="form-stack">
          <input v-model="taskTitle" class="input-field" placeholder="输入任务标题" />
          <input v-model="taskTime" class="input-field" placeholder="时间，例如 18:30" />
          <view>
            <view class="field-label">分类</view>
            <view class="pill-row">
              <button
                v-for="item in categories"
                :key="item.value"
                class="chip-button"
                :class="{ 'chip-button--active': selectedCategory === item.value }"
                @click="selectedCategory = item.value"
              >
                {{ item.label }}
              </button>
            </view>
          </view>
          <view>
            <view class="field-label">重复</view>
            <view class="pill-row">
              <button
                v-for="item in repeats"
                :key="item.value"
                class="chip-button"
                :class="{ 'chip-button--active': selectedRepeat === item.value }"
                @click="selectedRepeat = item.value"
              >
                {{ item.label }}
              </button>
            </view>
          </view>
          <view>
            <view class="field-label">奖励</view>
            <view class="pill-row">
              <button
                v-for="item in rewards"
                :key="item.value"
                class="chip-button"
                :class="{ 'chip-button--active': selectedReward === item.value }"
                @click="selectedReward = item.value"
              >
                {{ item.label }}
              </button>
            </view>
          </view>
          <button class="quick-action-button" @click="createNewTask">创建任务</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'
import type { RewardType, TaskCategory, TaskRepeatType } from '../types/koko'

const { t } = useLanguage()
const { tasks, createTask, setTaskStatus } = useKokoState()

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
        <view class="eyebrow">{{ t.planner.eyebrow }}</view>
        <view>{{ t.planner.title }}</view>
      </view>
      <view>{{ t.planner.subtitle }}</view>
    </view>

    <view class="page-grid-2">
      <view class="panel-block">
        <view class="eyebrow">{{ t.planner.formLabel }}</view>
        <view>{{ t.planner.formTitle }}</view>
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

      <view class="panel-block">
        <view class="eyebrow">{{ t.planner.guideLabel }}</view>
        <view>{{ t.planner.guideTitle }}</view>
        <view class="ordered-list">
          <view>创建一条新的任务，让它出现在首页待办摘要。</view>
          <view>在硬件页触发“到点提醒”，演示跨端联动提示。</view>
          <view>回到这里标记完成，观察宠物心情和亲密度提升。</view>
        </view>
      </view>

      <view class="panel-block panel-block--full">
        <view class="eyebrow">{{ t.planner.listLabel }}</view>
        <view>{{ t.planner.listTitle }}</view>
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
    </view>
  </view>
</template>

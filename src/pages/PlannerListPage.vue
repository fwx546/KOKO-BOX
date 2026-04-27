<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'
import type { Task, TaskCategory, TaskPriority } from '../types/koko'

const { todayTasks, inboxTasks, upcomingTasks, completedTasks, setTaskStatus } = useKokoState()
const { t } = useLanguage()

const mode = ref<'today' | 'inbox' | 'upcoming' | 'done'>('today')
const keyword = ref('')
const selectedCategory = ref<'all' | TaskCategory>('all')

type PlannerTask = Task & {
  notes: string
  dueDate: string
  priority: TaskPriority
  isStarred: boolean
  subtasks: Array<{ id: string; title: string; completed: boolean }>
}

const normalizeTask = (task: Task): PlannerTask => ({
  ...task,
  notes: task.notes ?? '',
  dueDate: task.dueDate ?? '',
  priority: task.priority ?? 'medium',
  isStarred: task.isStarred ?? false,
  subtasks: task.subtasks ?? [],
})

const sourceTasks = computed(() => {
  if (mode.value === 'inbox') return inboxTasks.value
  if (mode.value === 'upcoming') return upcomingTasks.value
  if (mode.value === 'done') return completedTasks.value
  return todayTasks.value
})

const visibleTasks = computed(() =>
  sourceTasks.value
    .map(normalizeTask)
    .filter((task) => {
      const matchesKeyword =
        !keyword.value.trim() ||
        `${task.title} ${task.notes} ${task.subtasks.map((item) => item.title).join(' ')}`
          .toLowerCase()
          .includes(keyword.value.trim().toLowerCase())
      const matchesCategory = selectedCategory.value === 'all' || task.category === selectedCategory.value
      return matchesKeyword && matchesCategory
    }),
)

const titleMap = computed<Record<typeof mode.value, string>>(() => ({
  today: t.value.plannerList.today,
  inbox: t.value.plannerList.inbox,
  upcoming: t.value.plannerList.upcoming,
  done: t.value.plannerList.done,
}))

const openTask = (taskId: string) => {
  uni.navigateTo({ url: `/pages/planner-task/index?id=${taskId}` })
}

onLoad((options) => {
  const nextMode = String(options?.mode ?? 'today')
  if (nextMode === 'inbox' || nextMode === 'upcoming' || nextMode === 'done' || nextMode === 'today') {
    mode.value = nextMode
  }
})
</script>

<template>
  <view class="page-view">
    <view class="page-head">
      <view>
        <view class="eyebrow">{{ t.plannerList.title }}</view>
        <view>{{ titleMap[mode] }}</view>
      </view>
      <view>{{ t.plannerList.subtitle }}</view>
    </view>

    <view class="panel-block planner-list-page">
      <input v-model="keyword" class="input-field" :placeholder="t.plannerList.search" />
      <view class="pill-row">
        <button class="chip-button" :class="{ 'chip-button--active': selectedCategory === 'all' }" @click="selectedCategory = 'all'">{{ t.plannerList.all }}</button>
        <button class="chip-button" @click="selectedCategory = 'work'">{{ t.planner.categories.work }}</button>
        <button class="chip-button" @click="selectedCategory = 'study'">{{ t.planner.categories.study }}</button>
        <button class="chip-button" @click="selectedCategory = 'life'">{{ t.planner.categories.life }}</button>
        <button class="chip-button" @click="selectedCategory = 'health'">{{ t.planner.categories.health }}</button>
      </view>

      <view class="planner-list-compact">
        <button v-for="task in visibleTasks" :key="task.id" class="planner-list-card" @click="openTask(task.id)">
          <view class="planner-list-card__row">
            <view class="planner-list-card__title">{{ task.title }}</view>
            <button
              v-if="task.status !== 'completed'"
              class="planner-check-button"
              @click.stop="setTaskStatus(task.id, 'completed')"
            >
              {{ t.plannerList.complete }}
            </button>
          </view>
          <view class="planner-list-card__meta">{{ task.dueDate || t.plannerList.noDate }} · {{ task.priority }} · {{ task.subtasks.filter((item) => item.completed).length }}/{{ task.subtasks.length }}</view>
        </button>
        <view v-if="!visibleTasks.length" class="planner-empty-state">{{ t.plannerList.empty }}</view>
      </view>
    </view>
  </view>
</template>

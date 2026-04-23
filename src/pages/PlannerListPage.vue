<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useKokoState } from '../composables/useKokoState'
import type { Task, TaskCategory, TaskPriority, TaskStatus } from '../types/koko'

const { tasks, todayTasks, inboxTasks, upcomingTasks, completedTasks, setTaskStatus } = useKokoState()

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

const titleMap: Record<typeof mode.value, string> = {
  today: 'Today',
  inbox: 'Inbox',
  upcoming: 'Upcoming',
  done: 'Done',
}

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
        <view class="eyebrow">Task List</view>
        <view>{{ titleMap[mode] }}</view>
      </view>
      <view>Browse a single list at a time so this page stays focused and easy to scan.</view>
    </view>

    <view class="panel-block planner-list-page">
      <input v-model="keyword" class="input-field" placeholder="Search in this list" />
      <view class="pill-row">
        <button class="chip-button" :class="{ 'chip-button--active': selectedCategory === 'all' }" @click="selectedCategory = 'all'">Any</button>
        <button class="chip-button" @click="selectedCategory = 'work'">Work</button>
        <button class="chip-button" @click="selectedCategory = 'study'">Study</button>
        <button class="chip-button" @click="selectedCategory = 'life'">Life</button>
        <button class="chip-button" @click="selectedCategory = 'health'">Health</button>
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
              Done
            </button>
          </view>
          <view class="planner-list-card__meta">{{ task.dueDate || 'No date' }} · {{ task.priority }} · {{ task.subtasks.filter((item) => item.completed).length }}/{{ task.subtasks.length }}</view>
        </button>
        <view v-if="!visibleTasks.length" class="planner-empty-state">No tasks in this list.</view>
      </view>
    </view>
  </view>
</template>

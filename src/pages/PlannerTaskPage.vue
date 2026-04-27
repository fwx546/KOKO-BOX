<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'
import type { Task, TaskPriority } from '../types/koko'

const { tasks, updateTask, deleteTask, setTaskStatus } = useKokoState()
const { t } = useLanguage()

const taskId = ref('')

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

const task = computed(() => {
  const found = tasks.value.find((item) => item.id === taskId.value)
  return found ? normalizeTask(found) : null
})

const saveField = <K extends keyof PlannerTask>(key: K, value: PlannerTask[K]) => {
  if (!task.value) return
  updateTask(task.value.id, { [key]: value } as Partial<Task>)
}

const addSubtask = () => {
  if (!task.value) return
  updateTask(task.value.id, {
    subtasks: [...task.value.subtasks, { id: `subtask-${Date.now()}`, title: t.value.plannerTask.newSubtask, completed: false }],
  })
}

const updateSubtask = (subtaskId: string, changes: { title?: string; completed?: boolean }) => {
  if (!task.value) return
  updateTask(task.value.id, {
    subtasks: task.value.subtasks.map((item) => (item.id === subtaskId ? { ...item, ...changes } : item)),
  })
}

const removeSubtask = (subtaskId: string) => {
  if (!task.value) return
  updateTask(task.value.id, {
    subtasks: task.value.subtasks.filter((item) => item.id !== subtaskId),
  })
}

const removeCurrentTask = () => {
  if (!task.value) return
  deleteTask(task.value.id)
  uni.navigateBack()
}

onLoad((options) => {
  taskId.value = String(options?.id ?? '')
})
</script>

<template>
  <view class="page-view" v-if="task">
    <view class="page-head">
      <view>
        <view class="eyebrow">{{ t.plannerTask.eyebrow }}</view>
        <view>{{ task.title }}</view>
      </view>
      <view>{{ t.plannerTask.subtitle }}</view>
    </view>

    <view class="panel-block planner-form-page">
      <input class="input-field" :value="task.title" @blur="saveField('title', $event.detail.value)" />
      <textarea class="planner-textarea" :value="task.notes" :placeholder="t.plannerTask.notesPlaceholder" @blur="saveField('notes', $event.detail.value)" />
      <view class="planner-inline-fields">
        <input class="input-field" type="date" :value="task.dueDate" @change="saveField('dueDate', $event.detail.value)" />
        <input class="input-field" type="time" :value="task.time" @change="saveField('time', $event.detail.value)" />
      </view>
      <view class="planner-inline-fields">
        <input class="input-field" :value="task.category" @blur="saveField('category', $event.detail.value)" />
        <input class="input-field" :value="task.priority" @blur="saveField('priority', $event.detail.value)" />
      </view>
      <view class="planner-inline-fields">
        <button class="quick-action-button" @click="setTaskStatus(task.id, 'completed')">{{ t.plannerTask.complete }}</button>
        <button class="quick-action-button quick-action-button--ghost" @click="setTaskStatus(task.id, 'delayed')">{{ t.plannerTask.later }}</button>
      </view>
      <view class="planner-checklist">
        <view class="planner-section-head">
          <view>{{ t.plannerTask.checklist }}</view>
          <button class="profile-shortcut-button" @click="addSubtask">{{ t.plannerTask.add }}</button>
        </view>
        <view class="planner-subtask-row" v-for="subtask in task.subtasks" :key="subtask.id">
          <checkbox :checked="subtask.completed" @click="updateSubtask(subtask.id, { completed: !subtask.completed })" />
          <input class="input-field" :value="subtask.title" @blur="updateSubtask(subtask.id, { title: $event.detail.value })" />
          <button class="profile-shortcut-button" @click="removeSubtask(subtask.id)">{{ t.plannerTask.remove }}</button>
        </view>
      </view>
      <button class="quick-action-button quick-action-button--ghost" @click="removeCurrentTask">{{ t.plannerTask.delete }}</button>
    </view>
  </view>
</template>

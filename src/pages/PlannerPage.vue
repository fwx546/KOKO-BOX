<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCourseScheduleImporter } from '../composables/useCourseScheduleImporter'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'
import type { Task, TaskCategory, TaskKind } from '../types/koko'

const { tasks, todayTasks, completedTasks, courseSchedule, createTask, updateTask, setTaskStatus } = useKokoState()
const { t } = useLanguage()

type StyledTaskCard = Task & {
  categoryIcon: string
  categoryLabel: string
  cardBorderColor: string
}

type EditorMode = 'create' | 'edit'

const categoryMeta = computed<Record<TaskCategory, { icon: string; label: string }>>(() => ({
  schedule: { icon: '⏰', label: t.value.planner.categories.schedule },
  study: { icon: '✏️', label: t.value.planner.categories.study },
  work: { icon: '📋', label: t.value.planner.categories.work },
  health: { icon: '🌿', label: t.value.planner.categories.health },
  life: { icon: '🏠', label: t.value.planner.categories.life },
}))

const iconOptions = ['🌿', '✏️', '📋', '⏰', '🏠', '🍓']
const colorOptions = ['#d9cff3', '#cfefd7', '#ffe9ad', '#ffd3dc', '#d6e8fa', '#ffd8c9']
const showCreateChoice = ref(false)
const editorVisible = ref(false)
const editorMode = ref<EditorMode>('create')
const editorKind = ref<TaskKind>('task')
const editingTaskId = ref('')
const formTitle = ref('')
const formDate = ref('')
const formIcon = ref(iconOptions[2])
const formBorderColor = ref(colorOptions[0])

const todayDate = () => new Date().toISOString().slice(0, 10)
const defaultIconForKind = (kind: TaskKind) => (kind === 'ddl' ? '⏰' : '📋')
const defaultBorderForKind = (kind: TaskKind) => (kind === 'ddl' ? colorOptions[2] : colorOptions[0])

const toStyledCard = (task: Task, index: number): StyledTaskCard => {
  const meta = categoryMeta.value[task.category] ?? categoryMeta.value.life

  return {
    ...task,
    categoryIcon: task.icon || meta.icon,
    categoryLabel: meta.label,
    cardBorderColor: task.borderColor || colorOptions[index % colorOptions.length],
  }
}

const isDdlTask = (task: Task) => task.kind === 'ddl'

const ddlCards = computed(() =>
  tasks.value
    .filter((task) => isDdlTask(task) && task.status !== 'completed')
    .slice()
    .sort((left, right) => `${left.dueDate ?? ''} ${left.time}`.localeCompare(`${right.dueDate ?? ''} ${right.time}`))
    .map(toStyledCard),
)

const pendingCards = computed(() => todayTasks.value.filter((task) => !isDdlTask(task)).map(toStyledCard))
const doneCards = computed(() => completedTasks.value.filter((task) => !isDdlTask(task)).map(toStyledCard))
const importedCourses = computed(() => courseSchedule.value?.courses ?? [])
const hasCourseSchedule = computed(() => importedCourses.value.length > 0)

const {
  showScheduleImporter,
  importingSchedule,
  scheduleImportError,
  openScheduleImporter,
  closeScheduleImporter,
  importScheduleFromScreenshot,
} = useCourseScheduleImporter({
  onImported: () => {
    uni.navigateTo({ url: '/pages/schedule/index' })
  },
})

const openCreateChoice = () => {
  showCreateChoice.value = true
}

const closeCreateChoice = () => {
  showCreateChoice.value = false
}

const openSchedulePage = () => {
  if (!hasCourseSchedule.value) {
    openScheduleImporter()
    return
  }

  uni.navigateTo({ url: '/pages/schedule/index' })
}

const openEditor = (mode: EditorMode, kind: TaskKind, task?: Task) => {
  const fallbackCategory = kind === 'ddl' ? 'schedule' : 'work'
  const fallbackMeta = categoryMeta.value[task?.category ?? fallbackCategory]

  editorMode.value = mode
  editorKind.value = kind
  editingTaskId.value = task?.id ?? ''
  formTitle.value = task?.title ?? ''
  formDate.value = kind === 'ddl' ? task?.dueDate || todayDate() : ''
  formIcon.value = task?.icon || fallbackMeta?.icon || defaultIconForKind(kind)
  formBorderColor.value = task?.borderColor || defaultBorderForKind(kind)
  showCreateChoice.value = false
  editorVisible.value = true
}

const closeEditor = () => {
  editorVisible.value = false
  editingTaskId.value = ''
  formTitle.value = ''
  formDate.value = ''
}

const chooseCreateKind = (kind: TaskKind) => {
  openEditor('create', kind)
}

const submitEditor = () => {
  const title = formTitle.value.trim()
  if (!title) {
    uni.showToast({ title: t.value.planner.titleRequired, icon: 'none' })
    return
  }

  if (editorKind.value === 'ddl' && !formDate.value) {
    uni.showToast({ title: t.value.planner.dateRequired, icon: 'none' })
    return
  }

  const sharedPayload = {
    title,
    kind: editorKind.value,
    icon: formIcon.value,
    borderColor: formBorderColor.value,
    dueDate: editorKind.value === 'ddl' ? formDate.value : '',
  }

  if (editorMode.value === 'edit' && editingTaskId.value) {
    updateTask(editingTaskId.value, sharedPayload)
  } else {
    createTask({
      ...sharedPayload,
      notes: '',
      category: editorKind.value === 'ddl' ? 'schedule' : 'work',
      time: editorKind.value === 'ddl' ? '23:59' : '09:00',
      repeatType: 'once',
      rewardType: 'mood',
      priority: 'medium',
      isStarred: false,
      subtasks: [],
    })
  }

  closeEditor()
}

const completeTask = (taskId: string) => {
  setTaskStatus(taskId, 'completed')
}

const undoCompleteTask = (taskId: string) => {
  setTaskStatus(taskId, 'pending')
}
</script>

<template>
  <view class="planner-punch-page">
    <button class="planner-punch-create planner-punch-create--corner" @click="openCreateChoice">{{ t.planner.create }}</button>

    <view class="planner-punch-board">
      <view class="planner-punch-section planner-punch-ddl-section">
        <view class="planner-punch-section__title">{{ t.planner.ddl }}</view>
        <view v-if="ddlCards.length" class="planner-punch-ddl-list">
          <button
            v-for="task in ddlCards"
            :key="task.id"
            class="planner-punch-ddl-item"
            :style="{ borderColor: task.cardBorderColor }"
            @click="openEditor('edit', 'ddl', task)"
          >
            <view class="planner-punch-ddl-item__icon">{{ task.categoryIcon }}</view>
            <view class="planner-punch-ddl-item__main">
              <view>{{ task.title }}</view>
            </view>
            <view class="planner-punch-ddl-item__date">{{ task.dueDate }}</view>
          </button>
        </view>
        <view v-else class="planner-punch-ddl-empty">{{ t.planner.noDdl }}</view>
      </view>

      <view class="planner-punch-section">
        <view class="planner-punch-section__title">{{ t.planner.pending }}</view>
        <view v-if="pendingCards.length" class="planner-punch-grid planner-punch-grid--pending">
          <view
            v-for="task in pendingCards"
            :key="task.id"
            class="planner-punch-card"
            :style="{ borderColor: task.cardBorderColor }"
            @click="openEditor('edit', 'task', task)"
          >
            <view class="planner-punch-card__body">
              <view class="planner-punch-card__icon">{{ task.categoryIcon }}</view>
              <view class="planner-punch-card__title">{{ task.title }}</view>
              <button class="planner-punch-check" :aria-label="t.planner.complete" @click.stop="completeTask(task.id)" />
            </view>
          </view>
        </view>
        <view v-else class="planner-punch-empty">{{ t.planner.pendingEmpty }}</view>
      </view>

      <view class="planner-punch-section">
        <view class="planner-punch-section__title">{{ t.planner.done }}</view>
        <view v-if="doneCards.length" class="planner-punch-grid">
          <view
            v-for="task in doneCards"
            :key="task.id"
            class="planner-punch-card planner-punch-card--done"
            :style="{ borderColor: task.cardBorderColor }"
            @click="openEditor('edit', 'task', task)"
          >
            <view class="planner-punch-card__body">
              <view class="planner-punch-card__icon">{{ task.categoryIcon }}</view>
              <view class="planner-punch-card__title">{{ task.title }}</view>
              <button class="planner-punch-undo" :aria-label="t.planner.undoComplete" @click.stop="undoCompleteTask(task.id)">↺</button>
            </view>
          </view>
        </view>
        <view v-else class="planner-punch-empty">{{ t.planner.doneEmpty }}</view>
      </view>
    </view>

    <button class="planner-schedule-fab" @click="openSchedulePage">{{ t.planner.schedule }}</button>

    <view v-if="showCreateChoice" class="planner-punch-choice-mask" @click="closeCreateChoice">
      <view class="planner-punch-choice" @click.stop>
        <button @click="chooseCreateKind('ddl')">{{ t.planner.createDdl }}</button>
        <button @click="chooseCreateKind('task')">{{ t.planner.createTask }}</button>
      </view>
    </view>

    <view v-if="showScheduleImporter" class="planner-punch-choice-mask" @click="closeScheduleImporter">
      <view class="planner-schedule-importer" @click.stop>
        <view class="planner-punch-editor__title">{{ t.planner.scheduleTitle }}</view>
        <view class="planner-schedule-importer__copy">{{ t.planner.scheduleImporterCopy }}</view>
        <button class="planner-schedule-importer__primary" :disabled="importingSchedule" @click="importScheduleFromScreenshot">
          {{ importingSchedule ? t.planner.recognizing : t.planner.importSchedule }}
        </button>
        <button class="planner-schedule-importer__ghost" :disabled="importingSchedule" @click="closeScheduleImporter">{{ t.planner.cancel }}</button>
        <view v-if="scheduleImportError" class="planner-schedule-importer__error">{{ scheduleImportError }}</view>
      </view>
    </view>

    <view v-if="editorVisible" class="planner-punch-editor-mask" @click="closeEditor">
      <view class="planner-punch-editor" @click.stop>
        <view class="planner-punch-editor__handle" />
        <view class="planner-punch-editor__title">
          {{ editorMode === 'create' ? t.planner.newLabel : t.planner.editLabel }}{{ editorKind === 'ddl' ? ' DDL' : t.planner.task }}
        </view>
        <input v-model="formTitle" class="planner-punch-editor__input" :placeholder="t.planner.titlePlaceholder" />
        <picker v-if="editorKind === 'ddl'" mode="date" :value="formDate" @change="formDate = $event.detail.value">
          <view class="planner-punch-editor__date">{{ formDate || t.planner.chooseDate }}</view>
        </picker>

        <view class="planner-punch-editor__label">{{ t.planner.icon }}</view>
        <view class="planner-punch-picker-row">
          <button
            v-for="icon in iconOptions"
            :key="icon"
            class="planner-punch-icon-option"
            :class="{ 'planner-punch-icon-option--active': formIcon === icon }"
            @click="formIcon = icon"
          >
            {{ icon }}
          </button>
        </view>

        <view class="planner-punch-editor__label">{{ t.planner.borderColor }}</view>
        <view class="planner-punch-picker-row">
          <button
            v-for="color in colorOptions"
            :key="color"
            class="planner-punch-color-option"
            :class="{ 'planner-punch-color-option--active': formBorderColor === color }"
            :style="{ background: color }"
            @click="formBorderColor = color"
          />
        </view>

        <view class="planner-punch-editor__actions">
          <button class="planner-punch-editor__ghost" @click="closeEditor">{{ t.planner.cancel }}</button>
          <button class="planner-punch-editor__primary" @click="submitEditor">{{ t.planner.save }}</button>
        </view>
      </view>
    </view>
  </view>
</template>

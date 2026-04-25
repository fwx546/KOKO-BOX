<script setup lang="ts">
import { computed, ref } from 'vue'
import PetLottieAvatar from '../components/PetLottieAvatar.vue'
import { useKokoState } from '../composables/useKokoState'
import type { Task, TaskCategory, TaskKind } from '../types/koko'

const { tasks, todayTasks, completedTasks, createTask, updateTask, setTaskStatus } = useKokoState()

type StyledTaskCard = Task & {
  categoryIcon: string
  categoryLabel: string
  cardBorderColor: string
}

type EditorMode = 'create' | 'edit'

const categoryMeta: Record<TaskCategory, { icon: string; label: string }> = {
  schedule: { icon: '⏰', label: '日程' },
  study: { icon: '✏️', label: '学习' },
  work: { icon: '📌', label: '工作' },
  health: { icon: '🌿', label: '健康' },
  life: { icon: '🏠', label: '生活' },
}

const iconOptions = ['🌿', '✏️', '📌', '⏰', '🏠', '🍰']
const colorOptions = ['#d9cff3', '#cfefd7', '#ffe9ad', '#ffd3dc', '#d6e8fa', '#ffd8c9']
const petTapCount = ref(0)
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
const defaultIconForKind = (kind: TaskKind) => (kind === 'ddl' ? '⏰' : '📌')
const defaultBorderForKind = (kind: TaskKind) => (kind === 'ddl' ? colorOptions[2] : colorOptions[0])

const toStyledCard = (task: Task, index: number): StyledTaskCard => {
  const meta = categoryMeta[task.category] ?? categoryMeta.life

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

const openCreateChoice = () => {
  showCreateChoice.value = true
}

const closeCreateChoice = () => {
  showCreateChoice.value = false
}

const openEditor = (mode: EditorMode, kind: TaskKind, task?: Task) => {
  const fallbackCategory = kind === 'ddl' ? 'schedule' : 'work'
  const fallbackMeta = categoryMeta[task?.category ?? fallbackCategory]

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
    uni.showToast({ title: '先写一个标题', icon: 'none' })
    return
  }

  if (editorKind.value === 'ddl' && !formDate.value) {
    uni.showToast({ title: '请选择日期', icon: 'none' })
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

const cheerPet = () => {
  petTapCount.value += 1
}
</script>

<template>
  <view class="planner-punch-page">
    <button class="planner-punch-create planner-punch-create--corner" @click="openCreateChoice">新建</button>

    <view class="planner-punch-board">
      <view class="planner-punch-section planner-punch-ddl-section">
        <view class="planner-punch-section__title">DDL</view>
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
        <view v-else class="planner-punch-ddl-empty">暂无临近截止事项</view>
      </view>

      <view class="planner-punch-section">
        <view class="planner-punch-section__title">未完成</view>
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
              <button class="planner-punch-check" @click.stop="completeTask(task.id)" aria-label="完成" />
            </view>
          </view>
        </view>
        <view v-else class="planner-punch-empty">未完成已经清空啦，可以休息一下，或者加一个小目标。</view>
      </view>

      <view class="planner-punch-section">
        <view class="planner-punch-section__title">已完成</view>
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
              <button class="planner-punch-undo" @click.stop="undoCompleteTask(task.id)" aria-label="取消完成">↺</button>
            </view>
          </view>
        </view>
        <view v-else class="planner-punch-empty">先从一个小目标开始，完成后它会来到这里。</view>
      </view>

      <view class="planner-punch-pet-zone">
        <button class="planner-punch-pet" :class="{ 'planner-punch-pet--tap': petTapCount % 2 === 1 }" @click="cheerPet">
          <PetLottieAvatar :size-rpx="120" />
        </button>
      </view>
    </view>

    <view v-if="showCreateChoice" class="planner-punch-choice-mask" @click="closeCreateChoice">
      <view class="planner-punch-choice" @click.stop>
        <button @click="chooseCreateKind('ddl')">创建 DDL</button>
        <button @click="chooseCreateKind('task')">创建任务</button>
      </view>
    </view>

    <view v-if="editorVisible" class="planner-punch-editor-mask" @click="closeEditor">
      <view class="planner-punch-editor" @click.stop>
        <view class="planner-punch-editor__handle" />
        <view class="planner-punch-editor__title">
          {{ editorMode === 'create' ? '新建' : '编辑' }}{{ editorKind === 'ddl' ? 'DDL' : '任务' }}
        </view>
        <input v-model="formTitle" class="planner-punch-editor__input" placeholder="写下标题" />
        <picker v-if="editorKind === 'ddl'" mode="date" :value="formDate" @change="formDate = $event.detail.value">
          <view class="planner-punch-editor__date">{{ formDate || '选择日期' }}</view>
        </picker>

        <view class="planner-punch-editor__label">图标</view>
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

        <view class="planner-punch-editor__label">边框颜色</view>
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
          <button class="planner-punch-editor__ghost" @click="closeEditor">取消</button>
          <button class="planner-punch-editor__primary" @click="submitEditor">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

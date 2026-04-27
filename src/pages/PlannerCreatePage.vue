<script setup lang="ts">
import { ref } from 'vue'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'
import type { RewardType, TaskCategory, TaskPriority, TaskRepeatType } from '../types/koko'

const { createTask } = useKokoState()
const { t } = useLanguage()

const title = ref('')
const notes = ref('')
const time = ref('09:00')
const dueDate = ref('')
const category = ref<TaskCategory>('work')
const repeatType = ref<TaskRepeatType>('once')
const rewardType = ref<RewardType>('mood')
const priority = ref<TaskPriority>('medium')
const isStarred = ref(false)
const subtasks = ref('')

const createNewTask = () => {
  if (!title.value.trim()) {
    return
  }

  createTask({
    title: title.value.trim(),
    notes: notes.value.trim(),
    time: time.value,
    dueDate: dueDate.value,
    category: category.value,
    repeatType: repeatType.value,
    rewardType: rewardType.value,
    priority: priority.value,
    isStarred: isStarred.value,
    subtasks: subtasks.value.split('\n'),
  })

  uni.navigateBack()
}
</script>

<template>
  <view class="page-view">
    <view class="page-head">
      <view>
        <view class="eyebrow">{{ t.plannerCreate.eyebrow }}</view>
        <view>{{ t.plannerCreate.title }}</view>
      </view>
      <view>{{ t.plannerCreate.subtitle }}</view>
    </view>

    <view class="panel-block planner-form-page">
      <input v-model="title" class="input-field" :placeholder="t.plannerCreate.titlePlaceholder" />
      <textarea v-model="notes" class="planner-textarea" :placeholder="t.plannerCreate.notesPlaceholder" />
      <view class="planner-inline-fields">
        <input v-model="dueDate" class="input-field" type="date" />
        <input v-model="time" class="input-field" type="time" />
      </view>
      <view class="planner-inline-fields">
        <input v-model="category" class="input-field" :placeholder="t.plannerCreate.categoryPlaceholder" />
        <input v-model="priority" class="input-field" :placeholder="t.plannerCreate.priorityPlaceholder" />
      </view>
      <view class="planner-inline-fields">
        <input v-model="repeatType" class="input-field" :placeholder="t.plannerCreate.repeatPlaceholder" />
        <input v-model="rewardType" class="input-field" :placeholder="t.plannerCreate.rewardPlaceholder" />
      </view>
      <textarea v-model="subtasks" class="planner-textarea" :placeholder="t.plannerCreate.subtasksPlaceholder" />
      <label class="planner-checkbox-row">
        <checkbox :checked="isStarred" @click="isStarred = !isStarred" />
        <view>{{ t.plannerCreate.starred }}</view>
      </label>
      <button class="quick-action-button" @click="createNewTask">{{ t.plannerCreate.create }}</button>
    </view>
  </view>
</template>

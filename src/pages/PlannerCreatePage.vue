<script setup lang="ts">
import { ref } from 'vue'
import { useKokoState } from '../composables/useKokoState'
import type { RewardType, TaskCategory, TaskPriority, TaskRepeatType } from '../types/koko'

const { createTask } = useKokoState()

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
        <view class="eyebrow">新建任务</view>
        <view>写下一个小目标</view>
      </view>
      <view>把复杂内容放在单独页面里，待办首页会更清爽。</view>
    </view>

    <view class="panel-block planner-form-page">
      <input v-model="title" class="input-field" placeholder="任务标题" />
      <textarea v-model="notes" class="planner-textarea" placeholder="备注" />
      <view class="planner-inline-fields">
        <input v-model="dueDate" class="input-field" type="date" />
        <input v-model="time" class="input-field" type="time" />
      </view>
      <view class="planner-inline-fields">
        <input v-model="category" class="input-field" placeholder="分类：work/study/life/health/schedule" />
        <input v-model="priority" class="input-field" placeholder="优先级：high/medium/low" />
      </view>
      <view class="planner-inline-fields">
        <input v-model="repeatType" class="input-field" placeholder="重复：once/daily/weekly" />
        <input v-model="rewardType" class="input-field" placeholder="奖励：mood/bond/snack/coin/toy" />
      </view>
      <textarea v-model="subtasks" class="planner-textarea" placeholder="清单项，每行一个" />
      <label class="planner-checkbox-row">
        <checkbox :checked="isStarred" @click="isStarred = !isStarred" />
        <view>设为重点</view>
      </label>
      <button class="quick-action-button" @click="createNewTask">创建任务</button>
    </view>
  </view>
</template>

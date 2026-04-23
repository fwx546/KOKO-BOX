<script setup lang="ts">
import ReminderCard from '../components/ReminderCard.vue'
import { useKokoState } from '../composables/useKokoState'

const { todayTasks, inboxTasks, dueSoonTasks, completedTodayCount, recentReminders } = useKokoState()

const openCreatePage = () => {
  uni.navigateTo({ url: '/pages/planner-create/index' })
}

const openListPage = (mode: 'today' | 'inbox' | 'upcoming' | 'done') => {
  uni.navigateTo({ url: `/pages/planner-list/index?mode=${mode}` })
}
</script>

<template>
  <view class="page-view">
    <view class="page-head">
      <view>
        <view class="eyebrow">Task Hub</view>
        <view>Planner</view>
      </view>
      <view>See only what matters right now, then step into dedicated pages for lists, creation, and editing.</view>
    </view>

    <view class="planner-home-shell">
      <view class="panel-block planner-home-topbar">
        <input class="input-field" disabled placeholder="Open Today or Inbox to browse tasks" />
        <button class="quick-action-button" @click="openCreatePage">New Task</button>
      </view>

      <view class="planner-home-grid">
        <button class="panel-block planner-home-card planner-home-card--hero" @click="openListPage('today')">
          <view class="eyebrow">Today</view>
          <view class="planner-home-card__value">{{ todayTasks.length }}</view>
          <view class="planner-home-card__copy">Tasks ready for action today.</view>
        </button>

        <button class="panel-block planner-home-card planner-home-card--hero" @click="openListPage('inbox')">
          <view class="eyebrow">Inbox</view>
          <view class="planner-home-card__value">{{ inboxTasks.length }}</view>
          <view class="planner-home-card__copy">Unsorted or unstarred work waiting to be triaged.</view>
        </button>

        <button class="panel-block planner-home-card" @click="openListPage('upcoming')">
          <view class="eyebrow">Due Soon</view>
          <view class="planner-home-card__mini-list">
            <view v-for="task in dueSoonTasks" :key="task.id">{{ task.title }}</view>
            <view v-if="!dueSoonTasks.length" class="planner-empty-state">Nothing urgent.</view>
          </view>
        </button>

        <button class="panel-block planner-home-card" @click="openListPage('done')">
          <view class="eyebrow">Completed Today</view>
          <view class="planner-home-card__value">{{ completedTodayCount }}</view>
          <view class="planner-home-card__copy">Finished tasks stay out of your way but remain easy to review.</view>
        </button>

        <view class="panel-block planner-home-card planner-home-card--full">
          <view class="planner-section-head">
            <view>
              <view class="eyebrow">Recent Reminders</view>
              <view>Signals</view>
            </view>
          </view>
          <view class="reminder-list">
            <ReminderCard
              v-for="item in recentReminders.slice(0, 2)"
              :key="item.id"
              :title="item.title"
              :subtitle="item.subtitle"
              :badge="item.badge"
              :tone="item.tone"
            />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

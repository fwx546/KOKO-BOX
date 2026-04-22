<script setup lang="ts">
import { computed } from 'vue'
import ReminderCard from '../components/ReminderCard.vue'
import StatusCard from '../components/StatusCard.vue'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'
import type { StatKey } from '../i18n'

const { t } = useLanguage()
const { pet, pendingTasks, recentReminders, carePet, syncEvents, settings } = useKokoState()

const statColors: Record<StatKey, string> = {
  health: 'var(--mint)',
  mood: 'var(--sun)',
  hunger: 'var(--peach)',
  energy: 'var(--sky)',
  intimacy: 'var(--rose)',
  clean: 'var(--lime)',
}

const statEntries = computed(() => {
  const labels = t.value.stats
  const valueMap: Record<StatKey, number> = {
    health: pet.value.health,
    mood: pet.value.mood,
    hunger: pet.value.hunger,
    energy: pet.value.energy,
    intimacy: pet.value.intimacy,
    clean: pet.value.clean,
  }

  return (Object.keys(valueMap) as StatKey[]).map((key) => ({
    key,
    value: valueMap[key],
    label: labels[key].label,
    hint: labels[key].hint,
    color: statColors[key],
  }))
})

const currentScene = computed(() => {
  const map = {
    normal: {
      title: '今天状态平稳',
      line: '情绪和精力都处于适合推进任务的区间。',
    },
    hungry: {
      title: '有点饿了',
      line: '先补一顿主食，后续互动会更积极。',
    },
    tired: {
      title: '需要休息',
      line: '把可可送回窝里休息，精力会更快恢复。',
    },
    low: {
      title: '情绪偏低',
      line: '适合先聊天安抚，再做一件很小的事。',
    },
    sick: {
      title: '状态脆弱',
      line: '建议优先治疗和清洁，避免持续下滑。',
    },
    resting: {
      title: '正在休息',
      line: '此时动作频率降低，更适合低打扰陪伴。',
    },
  }

  return map[pet.value.state]
})

const latestSync = computed(() => syncEvents.value[0]?.summary || '还没有新的联动事件。')

const openPage = (url: string) => {
  uni.navigateTo({ url })
}
</script>

<template>
  <view class="page-view">
    <view class="page-head">
      <view>
        <view class="eyebrow">{{ t.home.eyebrow }}</view>
        <view>{{ t.home.title }}</view>
      </view>
      <view>{{ t.home.subtitle }}</view>
    </view>

    <view class="page-grid-2">
      <view class="hero-card panel-block--full">
        <view class="hero-layout">
          <view class="pet-figure">
            <view class="pet-figure__ear pet-figure__ear--left" />
            <view class="pet-figure__ear pet-figure__ear--right" />
            <view class="pet-figure__face">
              <view class="pet-figure__eye" />
              <view class="pet-figure__eye" />
              <view class="pet-figure__mouth" />
            </view>
          </view>

          <view class="hero-copy">
            <view class="eyebrow">{{ t.home.heroTitle }}</view>
            <view>{{ pet.name }} · {{ pet.stage }} · {{ pet.state }}</view>
            <view>{{ currentScene.title }}</view>
            <view class="muted-line">{{ currentScene.line }}</view>
            <view class="summary-card__list">
              <view>
                <view>主线定位</view>
                <view>{{ settings.demoMode ? 'Demo 模式已开启' : '真实交互模式' }}</view>
              </view>
              <view>
                <view>最近联动</view>
                <view>{{ latestSync }}</view>
              </view>
              <view>
                <view>待办数量</view>
                <view>{{ pendingTasks.length }} 项</view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.home.actionLabel }}</view>
        <view>{{ t.home.actionTitle }}</view>
        <view class="quick-action-grid">
          <button class="quick-action-button" @click="carePet('feedMeal')">喂主食</button>
          <button class="quick-action-button" @click="carePet('clean')">清洁</button>
          <button class="quick-action-button" @click="carePet('heal')">治疗</button>
          <button class="quick-action-button" @click="carePet('play')">互动</button>
          <button class="quick-action-button" @click="carePet('rest')">回窝休息</button>
          <button class="quick-action-button quick-action-button--ghost" @click="openPage('/pages/planner/index')">
            打开计划页
          </button>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.home.taskLabel }}</view>
        <view>{{ t.home.taskTitle }}</view>
        <view class="simple-list">
          <view v-for="task in pendingTasks.slice(0, 3)" :key="task.id">
            <view>{{ task.title }}</view>
            <view>{{ task.time }}</view>
          </view>
          <view v-if="!pendingTasks.length">
            <view>今天没有待办任务</view>
            <view>可去计划页新增</view>
          </view>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.home.reminderLabel }}</view>
        <view>{{ t.home.reminderTitle }}</view>
        <view class="reminder-list">
          <ReminderCard
            v-for="item in recentReminders.slice(0, 3)"
            :key="item.id"
            :title="item.title"
            :subtitle="item.subtitle"
            :badge="item.badge"
            :tone="item.tone"
          />
        </view>
      </view>

      <view class="panel-block panel-block--full">
        <view class="eyebrow">{{ t.home.statusLabel }}</view>
        <view>{{ t.home.statusTitle }}</view>
        <view class="stats-grid">
          <StatusCard
            v-for="item in statEntries"
            :key="item.key"
            :label="item.label"
            :value="item.value"
            :hint="item.hint"
            :color="item.color"
          />
        </view>
      </view>
    </view>
  </view>
</template>

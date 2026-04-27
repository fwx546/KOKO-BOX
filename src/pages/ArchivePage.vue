<script setup lang="ts">
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'

const { archive, metrics } = useKokoState()
const { t } = useLanguage()

const openChat = () => {
  uni.navigateTo({
    url: '/pages/chat/index',
  })
}
</script>

<template>
  <view class="page-view archive-page-with-fab">
    <view class="page-head">
      <view>
        <view class="eyebrow">{{ t.archive.eyebrow }}</view>
        <view>{{ t.archive.title }}</view>
      </view>
      <view>{{ t.archive.subtitle }}</view>
    </view>

    <view class="page-grid-2">
      <view class="panel-block">
        <view class="eyebrow">{{ t.archive.basic }}</view>
        <view>{{ t.archive.adoption }}</view>
        <view class="bullet-list">
          <view>{{ t.archive.adoptedAt }}: {{ archive.adoptedAt }}</view>
          <view>{{ t.archive.companionTime }}: {{ metrics.companionMinutes }} {{ t.archive.minutes }}</view>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.archive.stageRecord }}</view>
        <view>{{ t.archive.stageHistory }}</view>
        <view class="simple-list">
          <view v-for="item in archive.stageHistory" :key="`${item.stage}-${item.timestamp}`">
            <view>{{ t.profile.stages[item.stage] ?? item.stage }}</view>
            <view>{{ item.timestamp }}</view>
          </view>
        </view>
      </view>

      <view class="panel-block panel-block--full">
        <view class="eyebrow">{{ t.archive.milestones }}</view>
        <view>{{ t.archive.milestoneTitle }}</view>
        <view class="archive-grid">
          <view v-for="item in archive.milestones" :key="item.id" class="archive-item">
            <view>{{ item.title }}</view>
            <view>{{ item.description }}</view>
            <view class="muted-line">{{ item.timestamp }}</view>
          </view>
        </view>
      </view>

      <view class="panel-block panel-block--full">
        <view class="eyebrow">{{ t.archive.healthRecord }}</view>
        <view>{{ t.archive.recentRecovery }}</view>
        <view class="card-list">
          <view v-for="item in archive.medicalLogs" :key="item.id" class="mini-card">
            <view>{{ item.note }}</view>
            <view>{{ item.timestamp }}</view>
          </view>
        </view>
      </view>
    </view>

    <button class="chat-fab" @click="openChat">AI</button>
  </view>
</template>

<script setup lang="ts">
import { useKokoState } from '../composables/useKokoState'

const { archive, metrics } = useKokoState()

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
        <view class="eyebrow">陪伴记录</view>
        <view>生命档案</view>
      </view>
      <view>这里记录团子的成长阶段、病史和里程碑。</view>
    </view>

    <view class="page-grid-2">
      <view class="panel-block">
        <view class="eyebrow">基础信息</view>
        <view>领养与陪伴</view>
        <view class="bullet-list">
          <view>领养时间：{{ archive.adoptedAt }}</view>
          <view>陪伴时长：{{ metrics.companionMinutes }} 分钟</view>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">阶段记录</view>
        <view>成长阶段历史</view>
        <view class="simple-list">
          <view v-for="item in archive.stageHistory" :key="`${item.stage}-${item.timestamp}`">
            <view>{{ item.stage }}</view>
            <view>{{ item.timestamp }}</view>
          </view>
        </view>
      </view>

      <view class="panel-block panel-block--full">
        <view class="eyebrow">里程碑</view>
        <view>关键成长瞬间</view>
        <view class="archive-grid">
          <view v-for="item in archive.milestones" :key="item.id" class="archive-item">
            <view>{{ item.title }}</view>
            <view>{{ item.description }}</view>
            <view class="muted-line">{{ item.timestamp }}</view>
          </view>
        </view>
      </view>

      <view class="panel-block panel-block--full">
        <view class="eyebrow">健康病史</view>
        <view>最近治疗记录</view>
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

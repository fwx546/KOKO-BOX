<script setup lang="ts">
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()
const { pet, carePet } = useKokoState()

const games = [
  { title: '贴贴互动', effect: '提升亲密度 +6' },
  { title: '团子小游戏', effect: '提升心情 +8' },
  { title: '轻松散步', effect: '提升精力 +5' },
]

const openPage = (url: string) => {
  uni.navigateTo({ url })
}
</script>

<template>
  <view class="page-view">
    <view class="page-head">
      <view>
        <view class="eyebrow">互动空间</view>
        <view>宠物互动</view>
      </view>
      <view>和团子玩一玩，让它保持活力和好心情。</view>
    </view>

    <view class="page-grid-2">
      <view class="panel-block">
        <view class="eyebrow">互动按键</view>
        <view>即时互动动作</view>
        <view class="action-stack">
          <button class="quick-action-button" @click="carePet('play')">一起玩耍</button>
          <button class="quick-action-button" @click="carePet('feedSnack')">奖励零食</button>
          <button class="quick-action-button" @click="carePet('rest')">放松休息</button>
          <button class="quick-action-button quick-action-button--ghost" @click="openPage('/pages/chat/index')">进入 AI 聊天</button>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">宠物状态</view>
        <view>{{ pet.name }} 当前状态</view>
        <view class="bullet-list">
          <view>成长阶段：{{ pet.stage }}</view>
          <view>心情值：{{ pet.mood }}</view>
          <view>亲密度：{{ pet.intimacy }}</view>
          <view>精力值：{{ pet.energy }}</view>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">互动玩法</view>
        <view>推荐活动</view>
        <view class="card-list">
          <view v-for="game in games" :key="game.title" class="mini-card">
            <view>{{ game.title }}</view>
            <view>{{ game.effect }}</view>
            <button class="profile-shortcut-button" @click="carePet('play')">模拟游玩</button>
          </view>
        </view>
      </view>

      <view class="panel-block panel-block--full">
        <view class="eyebrow">探索地图</view>
        <view>宠物小镇入口</view>
        <view class="muted-line">进入宠物小镇，解锁更多场景互动和后续扩展玩法。</view>
        <view class="action-stack">
          <button class="quick-action-button" @click="openPage('/pages/town/index')">进入宠物小镇</button>
        </view>
      </view>
    </view>
  </view>
</template>

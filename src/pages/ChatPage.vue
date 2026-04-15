<script setup lang="ts">
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()
</script>

<template>
  <view class="page-view">
    <view class="page-head">
      <view>
        <view class="eyebrow">{{ t.chatPage.eyebrow }}</view>
        <view>{{ t.chatPage.title }}</view>
      </view>
      <view>{{ t.chatPage.subtitle }}</view>
    </view>

    <view class="page-grid-2">
      <view class="panel-block">
        <view class="section-head section-head--compact">
          <view>
            <view class="eyebrow">{{ t.chatPage.modeLabel }}</view>
            <view>{{ t.chatPage.modeTitle }}</view>
          </view>
        </view>
        <view class="pill-row">
          <button class="quick-action-button" v-for="mode in t.chatPage.modes" :key="mode">{{ mode }}</button>
        </view>
      </view>

      <view class="panel-block">
        <view class="section-head section-head--compact">
          <view>
            <view class="eyebrow">{{ t.chatPage.emotionLabel }}</view>
            <view>{{ t.chatPage.emotionTitle }}</view>
          </view>
        </view>
        <view class="bullet-list">
          <view v-for="item in t.chatPage.emotionItems" :key="item">{{ item }}</view>
        </view>
      </view>

      <view class="panel-block">
        <view class="section-head section-head--compact">
          <view>
            <view class="eyebrow">{{ t.chatPage.memoryLabel }}</view>
            <view>{{ t.chatPage.memoryTitle }}</view>
          </view>
        </view>
        <view class="bullet-list">
          <view v-for="item in t.chatPage.memoryItems" :key="item">{{ item }}</view>
        </view>
      </view>

      <view class="panel-block">
        <view class="section-head section-head--compact">
          <view>
            <view class="eyebrow">{{ t.chatPage.privacyLabel }}</view>
            <view>{{ t.chatPage.privacyTitle }}</view>
          </view>
        </view>
        <view class="bullet-list">
          <view v-for="item in t.chatPage.privacyItems" :key="item">{{ item }}</view>
        </view>
      </view>

      <view class="chat-panel panel-block--full">
        <view class="chat-panel__bubble chat-panel__bubble--assistant">
          <view>{{ t.chatPage.assistantName }}</view>
          <view>{{ t.chatPage.assistantLine }}</view>
        </view>
        <view class="chat-panel__bubble chat-panel__bubble--user">
          <view>{{ t.chatPage.userName }}</view>
          <view>{{ t.chatPage.userLine }}</view>
        </view>
        <view class="chat-panel__input">
          <view>{{ t.chatPage.inputPlaceholder }}</view>
          <button>{{ t.chatPage.send }}</button>
        </view>
      </view>
    </view>
  </view>
</template>

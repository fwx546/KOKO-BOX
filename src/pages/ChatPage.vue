<script setup lang="ts">
import { computed } from 'vue'
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()

const quickPrompts = computed(() => t.value.chatPage.modes.slice(0, 2))
const memoryItems = computed(() => t.value.chatPage.memoryItems.slice(0, 2))
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
      <view class="panel-block panel-block--full">
        <view class="eyebrow">{{ t.chatPage.modeLabel }}</view>
        <view>{{ t.chatPage.modeTitle }}</view>
        <view class="pill-row">
          <button class="quick-action-button" v-for="prompt in quickPrompts" :key="prompt">{{ prompt }}</button>
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

      <view class="panel-block">
        <view class="eyebrow">{{ t.chatPage.memoryLabel }}</view>
        <view>{{ t.chatPage.memoryTitle }}</view>
        <view class="bullet-list">
          <view v-for="item in memoryItems" :key="item">{{ item }}</view>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.chatPage.privacyLabel }}</view>
        <view>{{ t.chatPage.privacyTitle }}</view>
        <view class="bullet-list">
          <view v-for="item in t.chatPage.privacyItems.slice(0, 2)" :key="item">{{ item }}</view>
        </view>
      </view>
    </view>
  </view>
</template>

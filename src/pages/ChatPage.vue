<script setup lang="ts">
import { computed, ref } from 'vue'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'
import type { EmotionTag } from '../types/koko'

const { t } = useLanguage()
const { messages, sendChatMessage, clearMessages, settings } = useKokoState()

const draft = ref('')
const selectedEmotion = ref<EmotionTag>('happy')

const quickEmotions: Array<{ value: EmotionTag; label: string; prompt: string }> = [
  { value: 'happy', label: '开心', prompt: '今天有点开心，想和你分享。' },
  { value: 'upset', label: '烦恼', prompt: '我现在有点烦，不知道怎么调整。' },
  { value: 'tired', label: '疲惫', prompt: '今天很累，脑子有点转不动。' },
  { value: 'bored', label: '无聊', prompt: '有点无聊，我们来点轻互动吧。' },
  { value: 'stressed', label: '压力大', prompt: '事情有点多，我有些压力。' },
  { value: 'lonely', label: '孤独', prompt: '现在有点想找人说说话。' },
  { value: 'proud', label: '自豪', prompt: '我刚完成了一件值得夸夸的事。' },
  { value: 'angry', label: '生气', prompt: '我现在情绪有点上头，想冷静一下。' },
]

const visibleMessages = computed(() =>
  messages.value.map((item) => ({
    ...item,
    displayContent: settings.value.hideChats && item.role === 'user' ? '当前用户消息已隐藏' : item.content,
  })),
)

const submit = async () => {
  if (!draft.value.trim()) {
    return
  }

  await sendChatMessage(draft.value, selectedEmotion.value)
  draft.value = ''
}

const sendQuickPrompt = async (emotion: (typeof quickEmotions)[number]) => {
  selectedEmotion.value = emotion.value
  await sendChatMessage(emotion.prompt, emotion.value)
}
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
      <view class="chat-panel panel-block--full">
        <view class="eyebrow">{{ t.chatPage.streamLabel }}</view>
        <view>{{ t.chatPage.streamTitle }}</view>
        <view v-for="message in visibleMessages" :key="message.id" class="chat-panel__bubble" :class="message.role === 'assistant' ? 'chat-panel__bubble--assistant' : 'chat-panel__bubble--user'">
          <view>{{ message.role === 'assistant' ? 'Koko' : '你' }}</view>
          <view>{{ message.displayContent }}</view>
        </view>
        <view class="form-stack">
          <input v-model="draft" class="input-field" :placeholder="t.chatPage.inputPlaceholder" />
          <view class="chat-panel__input">
            <view>当前情绪：{{ selectedEmotion }}</view>
            <button @click="submit">{{ t.chatPage.send }}</button>
          </view>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.chatPage.quickLabel }}</view>
        <view>{{ t.chatPage.quickTitle }}</view>
        <view class="pill-row">
          <button
            v-for="emotion in quickEmotions"
            :key="emotion.value"
            class="chip-button"
            :class="{ 'chip-button--active': selectedEmotion === emotion.value }"
            @click="selectedEmotion = emotion.value"
          >
            {{ emotion.label }}
          </button>
        </view>
        <view class="card-list">
          <view v-for="emotion in quickEmotions.slice(0, 4)" :key="emotion.value" class="mini-card">
            <view>{{ emotion.label }}</view>
            <view>{{ emotion.prompt }}</view>
            <button class="profile-shortcut-button" @click="sendQuickPrompt(emotion)">直接发送</button>
          </view>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.chatPage.privacyLabel }}</view>
        <view>{{ t.chatPage.privacyTitle }}</view>
        <view class="bullet-list">
          <view>隐藏聊天：{{ settings.hideChats ? '开启' : '关闭' }}</view>
          <view>允许清空：{{ settings.allowChatClear ? '开启' : '关闭' }}</view>
          <view>跨端摘要：{{ settings.allowCrossDeviceSummary ? '开启' : '关闭' }}</view>
        </view>
        <button class="quick-action-button quick-action-button--ghost" @click="clearMessages">
          {{ t.chatPage.clear }}
        </button>
      </view>
    </view>
  </view>
</template>

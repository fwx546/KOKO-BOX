<script setup lang="ts">
import { computed, ref } from 'vue'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'
import type { EmotionTag } from '../types/koko'

const { t } = useLanguage()
const { messages, sendChatMessage, clearMessages, settings } = useKokoState()

const draft = ref('')
const selectedEmotion = ref<EmotionTag>('happy')

const emotionOrder: EmotionTag[] = ['happy', 'upset', 'tired', 'bored', 'stressed', 'lonely', 'proud', 'angry']
const quickEmotions = computed(() =>
  emotionOrder.map((value) => ({
    value,
    label: t.value.chatPage.emotions[value].label,
    prompt: t.value.chatPage.emotions[value].prompt,
  })),
)

const visibleMessages = computed(() =>
  messages.value.map((item) => ({
    ...item,
    displayContent: settings.value.hideChats && item.role === 'user' ? t.value.chatPage.hiddenUserMessage : item.content,
  })),
)

const submit = async () => {
  if (!draft.value.trim()) {
    return
  }

  await sendChatMessage(draft.value, selectedEmotion.value)
  draft.value = ''
}

const sendQuickPrompt = async (emotion: { value: EmotionTag; prompt: string }) => {
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
          <view>{{ message.role === 'assistant' ? 'Koko' : t.chatPage.me }}</view>
          <view>{{ message.displayContent }}</view>
        </view>
        <view class="form-stack">
          <input v-model="draft" class="input-field" :placeholder="t.chatPage.inputPlaceholder" />
          <view class="chat-panel__input">
            <view>{{ t.chatPage.currentEmotion }}: {{ t.chatPage.emotions[selectedEmotion].label }}</view>
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
            <button class="profile-shortcut-button" @click="sendQuickPrompt(emotion)">{{ t.chatPage.sendDirectly }}</button>
          </view>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.chatPage.privacyLabel }}</view>
        <view>{{ t.chatPage.privacyTitle }}</view>
        <view class="bullet-list">
          <view>{{ t.chatPage.hideChats }}: {{ settings.hideChats ? t.chatPage.on : t.chatPage.off }}</view>
          <view>{{ t.chatPage.allowClear }}: {{ settings.allowChatClear ? t.chatPage.on : t.chatPage.off }}</view>
          <view>{{ t.chatPage.crossDeviceSummary }}: {{ settings.allowCrossDeviceSummary ? t.chatPage.on : t.chatPage.off }}</view>
        </view>
        <button class="quick-action-button quick-action-button--ghost" @click="clearMessages">
          {{ t.chatPage.clear }}
        </button>
      </view>
    </view>
  </view>
</template>

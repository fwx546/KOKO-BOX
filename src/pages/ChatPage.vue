<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import PetLottieAvatar from '../components/PetLottieAvatar.vue'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()
const { pet, messages, sendChatMessage, settings } = useKokoState()

const draft = ref('')
const sending = ref(false)
const scrollIntoView = ref('')

const visibleMessages = computed(() =>
  messages.value.map((item) => ({
    ...item,
    displayContent: settings.value.hideChats && item.role === 'user' ? t.value.chatPage.hiddenUserMessage : item.content,
    timeLabel: new Date(item.createdAt).toLocaleTimeString(settings.value.language === 'zh' ? 'zh-CN' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  })),
)

const submit = async () => {
  const value = draft.value.trim()
  if (!value || sending.value) return

  sending.value = true
  draft.value = ''
  try {
    const result = await sendChatMessage(value)
    if (result?.coinReward.awarded) {
      uni.showToast({ title: `+${result.coinReward.amount}`, icon: 'none' })
    }
  } finally {
    sending.value = false
  }
}

watch(
  () => visibleMessages.value.length,
  async () => {
    await nextTick()
    const last = visibleMessages.value[visibleMessages.value.length - 1]
    if (last) scrollIntoView.value = `message-${last.id}`
  },
  { immediate: true },
)
</script>

<template>
  <view class="chat-screen">
    <scroll-view class="chat-stream" scroll-y :scroll-into-view="scrollIntoView" scroll-with-animation>
      <view class="chat-stream__inner">
        <view
          v-for="message in visibleMessages"
          :id="`message-${message.id}`"
          :key="message.id"
          class="message-row"
          :class="message.role === 'assistant' ? 'message-row--assistant' : 'message-row--user'"
        >
          <view v-if="message.role === 'assistant'" class="message-avatar">
            <PetLottieAvatar :size-rpx="76" />
          </view>
          <view class="message-stack">
            <view class="message-meta">
              {{ message.role === 'assistant' ? pet.name : t.chatPage.me }} · {{ message.timeLabel }}
            </view>
            <view class="message-bubble">{{ message.displayContent }}</view>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="chat-composer">
      <view class="chat-composer__pet">
        <PetLottieAvatar :size-rpx="138" />
      </view>
      <view class="chat-composer__bar">
        <input
          v-model="draft"
          class="chat-composer__input"
          :placeholder="t.chatPage.inputPlaceholder"
          confirm-type="send"
          :disabled="sending"
          @confirm="submit"
        />
        <button class="chat-composer__send" :disabled="sending || !draft.trim()" @click="submit">
          {{ sending ? t.chatPage.sending : t.chatPage.send }}
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.chat-screen {
  background: linear-gradient(180deg, #f6fbf3 0%, #fff8ec 48%, #eef9f5 100%);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.chat-composer__send::after {
  border: none;
}

.chat-stream {
  flex: 1;
  min-height: 0;
}

.chat-stream__inner {
  box-sizing: border-box;
  padding: 28rpx 24rpx 240rpx;
}

.message-row {
  display: flex;
  margin-bottom: 24rpx;
}

.message-row--assistant {
  justify-content: flex-start;
}

.message-row--user {
  justify-content: flex-end;
}

.message-avatar {
  align-items: center;
  background: rgba(255, 253, 248, 0.86);
  border: 2rpx solid rgba(95, 199, 168, 0.14);
  border-radius: 50%;
  display: flex;
  flex: 0 0 78rpx;
  height: 78rpx;
  justify-content: center;
  margin-right: 14rpx;
  overflow: hidden;
  width: 78rpx;
}

.message-stack {
  max-width: 560rpx;
  min-width: 0;
}

.message-row--user .message-stack {
  align-items: flex-end;
  display: flex;
  flex-direction: column;
}

.message-meta {
  color: #8a7a68;
  font-size: 20rpx;
  margin-bottom: 7rpx;
}

.message-bubble {
  border-radius: 8rpx 28rpx 28rpx;
  box-shadow: 0 10rpx 24rpx rgba(167, 124, 72, 0.08);
  box-sizing: border-box;
  color: #253047;
  font-size: 28rpx;
  line-height: 1.55;
  padding: 18rpx 22rpx;
  white-space: normal;
  word-break: break-word;
}

.message-row--assistant .message-bubble {
  background: rgba(255, 253, 248, 0.94);
  border: 2rpx solid rgba(176, 143, 102, 0.12);
}

.message-row--user .message-bubble {
  background: #dff5e8;
  border-radius: 28rpx 8rpx 28rpx 28rpx;
  color: #214d42;
}

.chat-composer {
  background: rgba(255, 248, 236, 0.96);
  border-top: 2rpx solid rgba(176, 143, 102, 0.12);
  bottom: 0;
  box-sizing: border-box;
  left: 0;
  padding: 40rpx 22rpx calc(22rpx + env(safe-area-inset-bottom));
  position: fixed;
  right: 0;
}

.chat-composer__pet {
  align-items: center;
  display: flex;
  height: 120rpx;
  justify-content: center;
  left: 34rpx;
  overflow: hidden;
  position: absolute;
  top: -94rpx;
  width: 150rpx;
}

.chat-composer__bar {
  align-items: center;
  background: rgba(255, 255, 255, 0.82);
  border: 2rpx solid rgba(176, 143, 102, 0.16);
  border-radius: 999rpx;
  display: flex;
  gap: 10rpx;
  padding: 8rpx;
}

.chat-composer__input {
  color: #253047;
  flex: 1;
  font-size: 27rpx;
  height: 82rpx;
  min-width: 0;
  padding: 0 24rpx;
}

.chat-composer__send {
  background: linear-gradient(135deg, #8adfb0, #6bd4c7);
  border: none;
  border-radius: 999rpx;
  color: #173f38;
  flex: 0 0 126rpx;
  font-size: 26rpx;
  font-weight: 800;
  height: 82rpx;
  line-height: 82rpx;
  margin: 0;
  padding: 0;
}

.chat-composer__send[disabled] {
  opacity: 0.48;
}
</style>

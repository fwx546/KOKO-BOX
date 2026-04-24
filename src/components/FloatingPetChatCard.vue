<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    collapsed?: boolean
    latestMessage: string
    sending?: boolean
  }>(),
  {
    collapsed: false,
    sending: false,
  },
)

const emit = defineEmits<{
  send: [value: string]
  openHistory: []
}>()

const draft = ref('')

const submit = () => {
  const value = draft.value.trim()
  if (!value || props.sending) return
  emit('send', value)
  draft.value = ''
}

watch(
  () => props.collapsed,
  (value) => {
    if (value) draft.value = ''
  },
)
</script>

<template>
  <view class="pet-chat-card" :class="{ 'pet-chat-card--collapsed': collapsed }">
    <view class="pet-chat-card__glow" />
    <view class="pet-chat-card__head">
      <view>
        <view class="pet-chat-card__eyebrow">AI PET LINK</view>
        <view class="pet-chat-card__title">Talk to your pet</view>
      </view>
      <button class="pet-chat-card__history" @click="emit('openHistory')">Log</button>
    </view>

    <view class="pet-chat-card__preview">{{ latestMessage }}</view>

    <view class="pet-chat-card__input">
      <input
        v-model="draft"
        class="pet-chat-card__field"
        :disabled="collapsed"
        placeholder="Type a message"
        confirm-type="send"
        @confirm="submit"
      />
      <button class="pet-chat-card__send" :disabled="collapsed || sending" @click="submit">
        {{ sending ? 'Sending' : 'Send' }}
      </button>
    </view>
  </view>
</template>

<style scoped>
.pet-chat-card {
  backdrop-filter: blur(18rpx);
  background:
    linear-gradient(180deg, rgba(240, 251, 255, 0.18), rgba(227, 242, 255, 0.08)),
    rgba(232, 246, 255, 0.05);
  border: 2rpx solid rgba(190, 233, 255, 0.38);
  border-radius: 30rpx;
  box-shadow: 0 14rpx 34rpx rgba(44, 96, 130, 0.08);
  overflow: hidden;
  padding: 18rpx 20rpx;
  position: relative;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.pet-chat-card--collapsed {
  opacity: 0.36;
  transform: scale(0.98);
}

.pet-chat-card__glow {
  background: linear-gradient(90deg, rgba(109, 213, 255, 0), rgba(109, 213, 255, 0.5), rgba(109, 213, 255, 0));
  height: 2rpx;
  left: 0;
  position: absolute;
  right: 0;
  top: 0;
}

.pet-chat-card__head {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.pet-chat-card__eyebrow {
  color: #8bb6d0;
  font-size: 20rpx;
  letter-spacing: 3rpx;
}

.pet-chat-card__title {
  color: #214457;
  font-size: 28rpx;
  font-weight: 700;
  margin-top: 4rpx;
}

.pet-chat-card__history,
.pet-chat-card__send {
  border: none;
  margin: 0;
  padding: 0;
}

.pet-chat-card__history::after,
.pet-chat-card__send::after {
  border: none;
}

.pet-chat-card__history {
  background: rgba(255, 255, 255, 0.24);
  border-radius: 999rpx;
  color: #4d7694;
  font-size: 21rpx;
  padding: 10rpx 18rpx;
}

.pet-chat-card__preview {
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: rgba(31, 62, 82, 0.8);
  display: -webkit-box;
  font-size: 22rpx;
  line-height: 1.55;
  margin-top: 10rpx;
  min-height: 58rpx;
  overflow: hidden;
}

.pet-chat-card__input {
  align-items: center;
  display: flex;
  gap: 12rpx;
  margin-top: 10rpx;
}

.pet-chat-card__field {
  background: rgba(255, 255, 255, 0.14);
  border: 2rpx solid rgba(198, 233, 255, 0.24);
  border-radius: 999rpx;
  color: #244456;
  flex: 1;
  font-size: 23rpx;
  height: 66rpx;
  padding: 0 20rpx;
}

.pet-chat-card__send {
  background: rgba(109, 183, 255, 0.18);
  border-radius: 999rpx;
  color: #24557d;
  font-size: 24rpx;
  font-weight: 700;
  padding: 14rpx 22rpx;
}
</style>

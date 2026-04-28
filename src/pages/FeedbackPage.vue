<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import {
  canUseFeedbackCloud,
  listAdminFeedback,
  listMyFeedback,
  submitFeedback,
  updateAdminFeedback,
  type FeedbackRecord,
  type FeedbackStatus,
  type FeedbackType,
} from '../services/feedbackCloud'

const { authMode, isGuestSession, isMockSession, login } = useAuth()

const typeOptions: Array<{ value: FeedbackType; label: string }> = [
  { value: 'suggestion', label: '建议' },
  { value: 'complaint', label: '投诉' },
]

const statusOptions: Array<{ value: FeedbackStatus; label: string }> = [
  { value: 'submitted', label: '已提交' },
  { value: 'reviewing', label: '处理中' },
  { value: 'resolved', label: '已处理' },
  { value: 'rejected', label: '不采纳' },
]

const adminFilterOptions: Array<{ value: FeedbackStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  ...statusOptions,
]

const activeType = ref<FeedbackType>('suggestion')
const content = ref('')
const myRecords = ref<FeedbackRecord[]>([])
const adminRecords = ref<FeedbackRecord[]>([])
const isAdmin = ref(false)
const activeView = ref<'mine' | 'admin'>('mine')
const adminFilter = ref<FeedbackStatus | 'all'>('all')
const loading = ref(false)
const submitting = ref(false)
const adminSavingId = ref('')
const adminStatusDrafts = reactive<Record<string, FeedbackStatus>>({})
const adminReplyDrafts = reactive<Record<string, string>>({})

const cloudAvailable = computed(() => canUseFeedbackCloud())
const canSubmit = computed(() => cloudAvailable.value && !isGuestSession.value && !isMockSession.value)
const trimmedContent = computed(() => content.value.trim())
const remainingCharacters = computed(() => Math.max(0, 1000 - content.value.length))
const submitDisabled = computed(() => submitting.value || !canSubmit.value || trimmedContent.value.length < 10)
const disabledHint = computed(() => {
  if (!cloudAvailable.value) {
    return '当前环境未配置微信云开发，无法保证仅本人和管理员可见。'
  }

  if (isGuestSession.value) {
    return '游客模式无法提交投诉与建议，请使用微信登录。'
  }

  if (isMockSession.value) {
    return '当前为本地模拟登录，无法提交私密反馈。'
  }

  return ''
})

const typeLabel = (type: FeedbackType) => typeOptions.find((item) => item.value === type)?.label ?? '建议'
const statusLabel = (status: FeedbackStatus) => statusOptions.find((item) => item.value === status)?.label ?? '已提交'
const statusIndex = (status: FeedbackStatus) => Math.max(0, statusOptions.findIndex((item) => item.value === status))
const filterIndex = computed(() => Math.max(0, adminFilterOptions.findIndex((item) => item.value === adminFilter.value)))

const formatDate = (value: string) => {
  if (!value) {
    return '暂无时间'
  }

  return value.slice(0, 16).replace('T', ' ')
}

const confirmSubmit = () =>
  new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '确认发送',
      content: '发送后内容不可编辑或删除，仅你本人和管理员可见。',
      confirmText: '发送',
      cancelText: '取消',
      success: (result) => {
        resolve(Boolean(result.confirm))
      },
      fail: () => {
        resolve(false)
      },
    })
  })

const syncAdminDrafts = (records: FeedbackRecord[]) => {
  records.forEach((record) => {
    adminStatusDrafts[record._id] = record.status
    adminReplyDrafts[record._id] = record.adminReply
  })
}

const loadMine = async () => {
  if (!cloudAvailable.value || isGuestSession.value || isMockSession.value) {
    myRecords.value = []
    isAdmin.value = false
    return
  }

  const result = await listMyFeedback()
  myRecords.value = result.records
  isAdmin.value = result.isAdmin
}

const loadAdmin = async () => {
  if (!isAdmin.value) {
    adminRecords.value = []
    return
  }

  const result = await listAdminFeedback(adminFilter.value)
  adminRecords.value = result.records
  syncAdminDrafts(result.records)
}

const refreshRecords = async () => {
  loading.value = true

  try {
    await loadMine()
    if (isAdmin.value) {
      await loadAdmin()
    } else {
      activeView.value = 'mine'
    }
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '加载失败',
      icon: 'none',
    })
  } finally {
    loading.value = false
  }
}

const handleSubmit = async () => {
  if (!canSubmit.value) {
    uni.showToast({
      title: disabledHint.value || '当前无法提交',
      icon: 'none',
    })
    return
  }

  if (trimmedContent.value.length < 10) {
    uni.showToast({
      title: '请至少输入 10 个字',
      icon: 'none',
    })
    return
  }

  const confirmed = await confirmSubmit()
  if (!confirmed) {
    return
  }

  submitting.value = true

  try {
    const result = await submitFeedback({
      type: activeType.value,
      content: trimmedContent.value,
    })
    myRecords.value = [result.record, ...myRecords.value]
    isAdmin.value = result.isAdmin
    content.value = ''
    uni.showToast({
      title: '已发送',
      icon: 'success',
    })
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '发送失败',
      icon: 'none',
    })
  } finally {
    submitting.value = false
  }
}

const changeAdminFilter = async (event: { detail?: { value?: number | string } }) => {
  const index = Number(event.detail?.value ?? 0)
  adminFilter.value = adminFilterOptions[index]?.value ?? 'all'
  await loadAdmin()
}

const changeAdminStatus = (recordId: string, event: { detail?: { value?: number | string } }) => {
  const index = Number(event.detail?.value ?? 0)
  adminStatusDrafts[recordId] = statusOptions[index]?.value ?? 'submitted'
}

const saveAdminRecord = async (record: FeedbackRecord) => {
  adminSavingId.value = record._id

  try {
    const result = await updateAdminFeedback({
      id: record._id,
      status: adminStatusDrafts[record._id] ?? record.status,
      adminReply: adminReplyDrafts[record._id] ?? '',
    })
    adminRecords.value = adminRecords.value.map((item) => (item._id === result.record._id ? result.record : item))
    myRecords.value = myRecords.value.map((item) => (item._id === result.record._id ? result.record : item))
    syncAdminDrafts([result.record])
    uni.showToast({
      title: '已更新',
      icon: 'success',
    })
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '更新失败',
      icon: 'none',
    })
  } finally {
    adminSavingId.value = ''
  }
}

onMounted(async () => {
  if (!authMode.value) {
    await login('wechat')
  }

  await refreshRecords()
})
</script>

<template>
  <view class="feedback-page">
    <view class="feedback-hero">
      <view>
        <view class="feedback-hero__eyebrow">投诉与建议</view>
        <view class="feedback-hero__title">向管理员发送私密反馈</view>
      </view>
      <view class="feedback-hero__copy">发送后不可编辑，仅本人和管理员可见。</view>
    </view>

    <view v-if="disabledHint" class="feedback-warning">{{ disabledHint }}</view>

    <view v-if="isAdmin" class="feedback-view-switch">
      <button
        class="feedback-view-switch__button"
        :class="{ 'feedback-view-switch__button--active': activeView === 'mine' }"
        @click="activeView = 'mine'"
      >
        我的反馈
      </button>
      <button
        class="feedback-view-switch__button"
        :class="{ 'feedback-view-switch__button--active': activeView === 'admin' }"
        @click="activeView = 'admin'"
      >
        管理处理
      </button>
    </view>

    <template v-if="activeView === 'mine'">
      <view class="feedback-panel">
        <view class="feedback-section-title">新建反馈</view>

        <view class="feedback-type-switch">
          <button
            v-for="item in typeOptions"
            :key="item.value"
            class="feedback-type-switch__button"
            :class="{ 'feedback-type-switch__button--active': activeType === item.value }"
            @click="activeType = item.value"
          >
            {{ item.label }}
          </button>
        </view>

        <textarea
          class="feedback-textarea"
          maxlength="1000"
          :value="content"
          placeholder="请写下你想投诉或建议的内容，至少 10 个字。"
          @input="(event) => (content = event.detail?.value ?? '')"
        />

        <view class="feedback-submit-row">
          <view class="feedback-counter">{{ remainingCharacters }} 字可用</view>
          <button class="feedback-submit" :disabled="submitDisabled" @click="handleSubmit">
            {{ submitting ? '发送中...' : '发送' }}
          </button>
        </view>
      </view>

      <view class="feedback-panel">
        <view class="feedback-section-header">
          <view class="feedback-section-title">我的记录</view>
          <button class="feedback-refresh" :disabled="loading" @click="refreshRecords">
            {{ loading ? '加载中' : '刷新' }}
          </button>
        </view>

        <view v-if="!myRecords.length" class="feedback-empty">暂无提交记录。</view>
        <view v-for="record in myRecords" :key="record._id" class="feedback-record">
          <view class="feedback-record__top">
            <view class="feedback-record__type">{{ typeLabel(record.type) }}</view>
            <view class="feedback-record__status">{{ statusLabel(record.status) }}</view>
          </view>
          <view class="feedback-record__time">{{ formatDate(record.createdAt) }}</view>
          <view class="feedback-record__content">{{ record.content }}</view>
          <view class="feedback-record__reply">
            <view class="feedback-record__reply-label">管理员回复</view>
            <view>{{ record.adminReply || '暂未回复' }}</view>
          </view>
        </view>
      </view>
    </template>

    <template v-else>
      <view class="feedback-panel">
        <view class="feedback-section-header">
          <view class="feedback-section-title">管理处理</view>
          <picker :range="adminFilterOptions.map((item) => item.label)" :value="filterIndex" @change="changeAdminFilter">
            <view class="feedback-filter">筛选：{{ adminFilterOptions[filterIndex]?.label ?? '全部' }}</view>
          </picker>
        </view>

        <view v-if="!adminRecords.length" class="feedback-empty">暂无匹配记录。</view>
        <view v-for="record in adminRecords" :key="record._id" class="feedback-record feedback-record--admin">
          <view class="feedback-record__top">
            <view class="feedback-record__type">{{ typeLabel(record.type) }}</view>
            <view class="feedback-record__status">{{ statusLabel(record.status) }}</view>
          </view>
          <view class="feedback-record__time">
            {{ formatDate(record.createdAt) }} · {{ record.ownerOpenid || '未知用户' }}
          </view>
          <view class="feedback-record__content">{{ record.content }}</view>

          <picker
            :range="statusOptions.map((item) => item.label)"
            :value="statusIndex(adminStatusDrafts[record._id] ?? record.status)"
            @change="changeAdminStatus(record._id, $event)"
          >
            <view class="feedback-admin-field">状态：{{ statusLabel(adminStatusDrafts[record._id] ?? record.status) }}</view>
          </picker>

          <textarea
            class="feedback-admin-reply"
            maxlength="1000"
            :value="adminReplyDrafts[record._id]"
            placeholder="填写管理员回复"
            @input="(event) => (adminReplyDrafts[record._id] = event.detail?.value ?? '')"
          />

          <button class="feedback-submit" :disabled="adminSavingId === record._id" @click="saveAdminRecord(record)">
            {{ adminSavingId === record._id ? '保存中...' : '保存处理结果' }}
          </button>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped>
.feedback-page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  min-height: 100%;
  padding: 24rpx;
}

.feedback-hero,
.feedback-panel,
.feedback-warning {
  background: #fffdf8;
  border: 2rpx solid rgba(176, 143, 102, 0.18);
  border-radius: 24rpx;
  box-shadow: 0 12rpx 26rpx rgba(167, 124, 72, 0.08);
}

.feedback-hero {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 24rpx;
}

.feedback-hero__eyebrow {
  color: #5f8c78;
  font-size: 24rpx;
  font-weight: 800;
}

.feedback-hero__title {
  color: #253047;
  font-size: 40rpx;
  font-weight: 800;
  line-height: 1.2;
}

.feedback-hero__copy,
.feedback-counter,
.feedback-empty,
.feedback-record__time,
.feedback-record__reply {
  color: #8a7a68;
  font-size: 24rpx;
  line-height: 1.45;
}

.feedback-warning {
  background: #fff0ca;
  color: #7d644f;
  font-size: 24rpx;
  line-height: 1.45;
  padding: 18rpx;
}

.feedback-view-switch,
.feedback-type-switch {
  display: flex;
  gap: 10rpx;
}

.feedback-view-switch__button,
.feedback-type-switch__button,
.feedback-refresh,
.feedback-submit {
  border-radius: 999rpx;
  font-weight: 800;
  line-height: 1;
  margin: 0;
}

.feedback-view-switch__button::after,
.feedback-type-switch__button::after,
.feedback-refresh::after,
.feedback-submit::after {
  border: 0;
}

.feedback-view-switch__button,
.feedback-type-switch__button {
  background: rgba(255, 255, 255, 0.74);
  color: #8a7a68;
  flex: 1;
  font-size: 26rpx;
  padding: 18rpx;
}

.feedback-view-switch__button--active,
.feedback-type-switch__button--active {
  background: #e8f7ef;
  color: #365f56;
}

.feedback-panel {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 20rpx;
}

.feedback-section-header {
  align-items: center;
  display: flex;
  gap: 12rpx;
  justify-content: space-between;
}

.feedback-section-title {
  color: #253047;
  font-size: 32rpx;
  font-weight: 800;
}

.feedback-textarea,
.feedback-admin-reply {
  background: #fff;
  border: 2rpx solid rgba(176, 143, 102, 0.18);
  border-radius: 18rpx;
  box-sizing: border-box;
  color: #253047;
  font-size: 28rpx;
  line-height: 1.5;
  min-height: 220rpx;
  padding: 18rpx;
  width: 100%;
}

.feedback-admin-reply {
  min-height: 150rpx;
}

.feedback-submit-row {
  align-items: center;
  display: flex;
  gap: 14rpx;
  justify-content: space-between;
}

.feedback-submit {
  background: linear-gradient(135deg, #8adfb0, #6bd4c7);
  color: #173f38;
  font-size: 28rpx;
  padding: 20rpx 30rpx;
}

.feedback-refresh,
.feedback-filter {
  background: #e8f7ef;
  border-radius: 999rpx;
  color: #365f56;
  font-size: 24rpx;
  font-weight: 800;
  padding: 14rpx 18rpx;
}

.feedback-record {
  background: rgba(255, 248, 236, 0.82);
  border: 2rpx solid rgba(176, 143, 102, 0.12);
  border-radius: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 18rpx;
}

.feedback-record--admin {
  background: #fff;
}

.feedback-record__top {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.feedback-record__type {
  color: #253047;
  font-size: 30rpx;
  font-weight: 800;
}

.feedback-record__status {
  background: #e8f7ef;
  border-radius: 999rpx;
  color: #365f56;
  font-size: 22rpx;
  font-weight: 800;
  padding: 8rpx 14rpx;
}

.feedback-record__content {
  color: #253047;
  font-size: 28rpx;
  line-height: 1.55;
  white-space: pre-wrap;
}

.feedback-record__reply {
  background: rgba(255, 255, 255, 0.72);
  border-radius: 16rpx;
  padding: 14rpx;
  white-space: pre-wrap;
}

.feedback-record__reply-label {
  color: #365f56;
  font-weight: 800;
  margin-bottom: 6rpx;
}

.feedback-admin-field {
  background: #fff0ca;
  border-radius: 16rpx;
  color: #7d644f;
  font-size: 26rpx;
  font-weight: 800;
  padding: 16rpx;
}
</style>

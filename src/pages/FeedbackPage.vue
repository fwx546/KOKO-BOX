<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useLanguage } from '../composables/useLanguage'
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
const { language } = useLanguage()

const feedbackCopy = computed(() =>
  language.value === 'zh'
    ? {
        title: '投诉与建议',
        heroTitle: '向管理员发送私密反馈',
        heroCopy: '发送后不可编辑，仅本人和管理员可见。',
        mine: '我的反馈',
        admin: '管理处理',
        newFeedback: '新建反馈',
        records: '我的记录',
        adminReply: '管理员回复',
        noReply: '暂未回复',
        noTime: '暂无时间',
        noRecords: '暂无提交记录。',
        noAdminRecords: '暂无匹配记录。',
        textareaPlaceholder: '请写下你想投诉或建议的内容，至少 10 个字。',
        adminReplyPlaceholder: '填写管理员回复',
        remaining: '字可用',
        send: '发送',
        sending: '发送中...',
        refresh: '刷新',
        loading: '加载中',
        filter: '筛选',
        state: '状态',
        unknownUser: '未知用户',
        saveResult: '保存处理结果',
        saving: '保存中...',
        confirmTitle: '确认发送',
        confirmContent: '发送后内容不可编辑或删除，仅你本人和管理员可见。',
        cancel: '取消',
        sent: '已发送',
        updated: '已更新',
        loadFailed: '加载失败',
        sendFailed: '发送失败',
        updateFailed: '更新失败',
        cannotSubmit: '当前无法提交',
        minLength: '请至少输入 10 个字',
        cloudUnavailable: '当前环境未配置微信云开发，无法保证仅本人和管理员可见。',
        guestDisabled: '游客模式无法提交投诉与建议，请使用微信登录。',
        mockDisabled: '当前为本地模拟登录，无法提交私密反馈。',
        types: {
          suggestion: '建议',
          complaint: '投诉',
        },
        statuses: {
          all: '全部',
          submitted: '已提交',
          reviewing: '处理中',
          resolved: '已处理',
          rejected: '不采纳',
        },
      }
    : {
        title: 'Complaints & Suggestions',
        heroTitle: 'Send private feedback to administrators',
        heroCopy: 'Submitted content cannot be edited and is only visible to you and administrators.',
        mine: 'My Feedback',
        admin: 'Admin Review',
        newFeedback: 'New Feedback',
        records: 'My Records',
        adminReply: 'Admin Reply',
        noReply: 'No reply yet',
        noTime: 'No time',
        noRecords: 'No submitted records yet.',
        noAdminRecords: 'No matching records.',
        textareaPlaceholder: 'Write your complaint or suggestion, at least 10 characters.',
        adminReplyPlaceholder: 'Write an administrator reply',
        remaining: 'characters left',
        send: 'Send',
        sending: 'Sending...',
        refresh: 'Refresh',
        loading: 'Loading',
        filter: 'Filter',
        state: 'Status',
        unknownUser: 'Unknown user',
        saveResult: 'Save Review Result',
        saving: 'Saving...',
        confirmTitle: 'Confirm Send',
        confirmContent: 'After sending, the content cannot be edited or deleted. Only you and administrators can view it.',
        cancel: 'Cancel',
        sent: 'Sent',
        updated: 'Updated',
        loadFailed: 'Load failed',
        sendFailed: 'Send failed',
        updateFailed: 'Update failed',
        cannotSubmit: 'Cannot submit now',
        minLength: 'Please enter at least 10 characters',
        cloudUnavailable: 'WeChat cloud is not configured, so private visibility cannot be guaranteed.',
        guestDisabled: 'Guest mode cannot submit feedback. Please sign in with WeChat.',
        mockDisabled: 'Local mock login cannot submit private feedback.',
        types: {
          suggestion: 'Suggestion',
          complaint: 'Complaint',
        },
        statuses: {
          all: 'All',
          submitted: 'Submitted',
          reviewing: 'Reviewing',
          resolved: 'Resolved',
          rejected: 'Rejected',
        },
      },
)

const typeOptions = computed<Array<{ value: FeedbackType; label: string }>>(() => [
  { value: 'suggestion', label: feedbackCopy.value.types.suggestion },
  { value: 'complaint', label: feedbackCopy.value.types.complaint },
])

const statusOptions = computed<Array<{ value: FeedbackStatus; label: string }>>(() => [
  { value: 'submitted', label: feedbackCopy.value.statuses.submitted },
  { value: 'reviewing', label: feedbackCopy.value.statuses.reviewing },
  { value: 'resolved', label: feedbackCopy.value.statuses.resolved },
  { value: 'rejected', label: feedbackCopy.value.statuses.rejected },
])

const adminFilterOptions = computed<Array<{ value: FeedbackStatus | 'all'; label: string }>>(() => [
  { value: 'all', label: feedbackCopy.value.statuses.all },
  ...statusOptions.value,
])

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
    return feedbackCopy.value.cloudUnavailable
  }

  if (isGuestSession.value) {
    return feedbackCopy.value.guestDisabled
  }

  if (isMockSession.value) {
    return feedbackCopy.value.mockDisabled
  }

  return ''
})

const typeLabel = (type: FeedbackType) => typeOptions.value.find((item) => item.value === type)?.label ?? feedbackCopy.value.types.suggestion
const statusLabel = (status: FeedbackStatus) => statusOptions.value.find((item) => item.value === status)?.label ?? feedbackCopy.value.statuses.submitted
const statusIndex = (status: FeedbackStatus) => Math.max(0, statusOptions.value.findIndex((item) => item.value === status))
const filterIndex = computed(() => Math.max(0, adminFilterOptions.value.findIndex((item) => item.value === adminFilter.value)))

const formatDate = (value: string) => {
  if (!value) {
    return feedbackCopy.value.noTime
  }

  return value.slice(0, 16).replace('T', ' ')
}

const confirmSubmit = () =>
  new Promise<boolean>((resolve) => {
    uni.showModal({
      title: feedbackCopy.value.confirmTitle,
      content: feedbackCopy.value.confirmContent,
      confirmText: feedbackCopy.value.send,
      cancelText: feedbackCopy.value.cancel,
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
      title: error instanceof Error ? error.message : feedbackCopy.value.loadFailed,
      icon: 'none',
    })
  } finally {
    loading.value = false
  }
}

const handleSubmit = async () => {
  if (!canSubmit.value) {
    uni.showToast({
      title: disabledHint.value || feedbackCopy.value.cannotSubmit,
      icon: 'none',
    })
    return
  }

  if (trimmedContent.value.length < 10) {
    uni.showToast({
      title: feedbackCopy.value.minLength,
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
      title: feedbackCopy.value.sent,
      icon: 'success',
    })
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : feedbackCopy.value.sendFailed,
      icon: 'none',
    })
  } finally {
    submitting.value = false
  }
}

const changeAdminFilter = async (event: { detail?: { value?: number | string } }) => {
  const index = Number(event.detail?.value ?? 0)
  adminFilter.value = adminFilterOptions.value[index]?.value ?? 'all'
  await loadAdmin()
}

const changeAdminStatus = (recordId: string, event: { detail?: { value?: number | string } }) => {
  const index = Number(event.detail?.value ?? 0)
  adminStatusDrafts[recordId] = statusOptions.value[index]?.value ?? 'submitted'
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
      title: feedbackCopy.value.updated,
      icon: 'success',
    })
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : feedbackCopy.value.updateFailed,
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
        <view class="feedback-hero__eyebrow">{{ feedbackCopy.title }}</view>
        <view class="feedback-hero__title">{{ feedbackCopy.heroTitle }}</view>
      </view>
      <view class="feedback-hero__copy">{{ feedbackCopy.heroCopy }}</view>
    </view>

    <view v-if="disabledHint" class="feedback-warning">{{ disabledHint }}</view>

    <view v-if="isAdmin" class="feedback-view-switch">
      <button
        class="feedback-view-switch__button"
        :class="{ 'feedback-view-switch__button--active': activeView === 'mine' }"
        @click="activeView = 'mine'"
      >
        {{ feedbackCopy.mine }}
      </button>
      <button
        class="feedback-view-switch__button"
        :class="{ 'feedback-view-switch__button--active': activeView === 'admin' }"
        @click="activeView = 'admin'"
      >
        {{ feedbackCopy.admin }}
      </button>
    </view>

    <template v-if="activeView === 'mine'">
      <view class="feedback-panel">
        <view class="feedback-section-title">{{ feedbackCopy.newFeedback }}</view>

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
          :placeholder="feedbackCopy.textareaPlaceholder"
          @input="(event) => (content = event.detail?.value ?? '')"
        />

        <view class="feedback-submit-row">
          <view class="feedback-counter">{{ remainingCharacters }} {{ feedbackCopy.remaining }}</view>
          <button class="feedback-submit" :disabled="submitDisabled" @click="handleSubmit">
            {{ submitting ? feedbackCopy.sending : feedbackCopy.send }}
          </button>
        </view>
      </view>

      <view class="feedback-panel">
        <view class="feedback-section-header">
          <view class="feedback-section-title">{{ feedbackCopy.records }}</view>
          <button class="feedback-refresh" :disabled="loading" @click="refreshRecords">
            {{ loading ? feedbackCopy.loading : feedbackCopy.refresh }}
          </button>
        </view>

        <view v-if="!myRecords.length" class="feedback-empty">{{ feedbackCopy.noRecords }}</view>
        <view v-for="record in myRecords" :key="record._id" class="feedback-record">
          <view class="feedback-record__top">
            <view class="feedback-record__type">{{ typeLabel(record.type) }}</view>
            <view class="feedback-record__status">{{ statusLabel(record.status) }}</view>
          </view>
          <view class="feedback-record__time">{{ formatDate(record.createdAt) }}</view>
          <view class="feedback-record__content">{{ record.content }}</view>
          <view class="feedback-record__reply">
            <view class="feedback-record__reply-label">{{ feedbackCopy.adminReply }}</view>
            <view>{{ record.adminReply || feedbackCopy.noReply }}</view>
          </view>
        </view>
      </view>
    </template>

    <template v-else>
      <view class="feedback-panel">
        <view class="feedback-section-header">
          <view class="feedback-section-title">{{ feedbackCopy.admin }}</view>
          <picker :range="adminFilterOptions.map((item) => item.label)" :value="filterIndex" @change="changeAdminFilter">
            <view class="feedback-filter">{{ feedbackCopy.filter }}: {{ adminFilterOptions[filterIndex]?.label ?? feedbackCopy.statuses.all }}</view>
          </picker>
        </view>

        <view v-if="!adminRecords.length" class="feedback-empty">{{ feedbackCopy.noAdminRecords }}</view>
        <view v-for="record in adminRecords" :key="record._id" class="feedback-record feedback-record--admin">
          <view class="feedback-record__top">
            <view class="feedback-record__type">{{ typeLabel(record.type) }}</view>
            <view class="feedback-record__status">{{ statusLabel(record.status) }}</view>
          </view>
          <view class="feedback-record__time">
            {{ formatDate(record.createdAt) }} · {{ record.ownerOpenid || feedbackCopy.unknownUser }}
          </view>
          <view class="feedback-record__content">{{ record.content }}</view>

          <picker
            :range="statusOptions.map((item) => item.label)"
            :value="statusIndex(adminStatusDrafts[record._id] ?? record.status)"
            @change="changeAdminStatus(record._id, $event)"
          >
            <view class="feedback-admin-field">{{ feedbackCopy.state }}: {{ statusLabel(adminStatusDrafts[record._id] ?? record.status) }}</view>
          </picker>

          <textarea
            class="feedback-admin-reply"
            maxlength="1000"
            :value="adminReplyDrafts[record._id]"
            :placeholder="feedbackCopy.adminReplyPlaceholder"
            @input="(event) => (adminReplyDrafts[record._id] = event.detail?.value ?? '')"
          />

          <button class="feedback-submit" :disabled="adminSavingId === record._id" @click="saveAdminRecord(record)">
            {{ adminSavingId === record._id ? feedbackCopy.saving : feedbackCopy.saveResult }}
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

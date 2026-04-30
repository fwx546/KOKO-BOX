<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCourseScheduleImporter } from '../composables/useCourseScheduleImporter'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'
import { useCorgiBle, type MiniProgramBleDevice } from '../services/corgiBle'
import type { Task, TaskCategory, TaskKind } from '../types/koko'

const { tasks, todayTasks, completedTasks, courseSchedule, createTask, updateTask, deleteTask, setTaskStatus, completeTaskWithReward, syncTasksFromCloud, triggerHardwareAction, updatePet } = useKokoState()
const { t } = useLanguage()
const corgiBle = useCorgiBle()
const MARKED_CALENDAR_DATES_KEY = 'koko-planner-marked-dates-v1'

type StyledTaskCard = Task & {
  categoryIcon: string
  categoryLabel: string
  cardBorderColor: string
}

type EditorMode = 'create' | 'edit'

const categoryMeta = computed<Record<TaskCategory, { icon: string; label: string }>>(() => ({
  schedule: { icon: '⏰', label: t.value.planner.categories.schedule },
  study: { icon: '✏️', label: t.value.planner.categories.study },
  work: { icon: '📋', label: t.value.planner.categories.work },
  health: { icon: '🌿', label: t.value.planner.categories.health },
  life: { icon: '🏠', label: t.value.planner.categories.life },
}))

const iconOptions = ['🌿', '✏️', '📋', '⏰', '🏠', '🍓']
const colorOptions = ['#d9cff3', '#cfefd7', '#ffe9ad', '#ffd3dc', '#d6e8fa', '#ffd8c9']
const showCreateChoice = ref(false)
const editorVisible = ref(false)
const editorMode = ref<EditorMode>('create')
const editorKind = ref<TaskKind>('task')
const editingTaskId = ref('')
const formTitle = ref('')
const formDate = ref('')
const formTime = ref('')
const formIcon = ref(iconOptions[2])
const formBorderColor = ref(colorOptions[0])
const deleteLabel = 'Delete'
const coinLabel = computed(() => (t.value.nav.home === '首页' ? '金币' : 'coins'))
const rewardClaimedLabel = computed(() => (t.value.nav.home === '首页' ? '奖励已领取' : 'Reward claimed'))
const pomodoroVisible = ref(false)
const pomodoroMinutes = ref(25)
const pomodoroRemainingSeconds = ref(25 * 60)
const pomodoroRunning = ref(false)
const pomodoroEnding = ref(false)
const pomodoroScanningDevices = ref(false)
const calendarNow = ref(new Date())
let calendarTimer: ReturnType<typeof setInterval> | undefined
let pomodoroTimer: ReturnType<typeof setInterval> | undefined

const todayDate = () => new Date().toISOString().slice(0, 10)
const toIsoDate = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}
const parseIsoDate = (iso: string) => {
  const [year, month, day] = iso.split('-').map((value) => Number(value))
  return new Date(year, (month || 1) - 1, day || 1)
}
const isZh = computed(() => t.value.nav.home === '首页')
const pomodoroDurationOptions = [5, 10, 15, 25, 45, 60]
const pomodoroDurationLabels = pomodoroDurationOptions.map((value) => `${value} min`)
const pomodoroDurationIndex = computed(() => {
  const index = pomodoroDurationOptions.indexOf(pomodoroMinutes.value)
  return index >= 0 ? index : 3
})
const pomodoroCountdownLabel = computed(() => {
  const minutes = Math.floor(pomodoroRemainingSeconds.value / 60)
  const seconds = pomodoroRemainingSeconds.value % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})
const pomodoroCopy = computed(() => ({
  buttonIdle: isZh.value ? '未设置番茄钟' : 'Pomodoro not set',
  buttonRunning: isZh.value ? `番茄钟 ${pomodoroCountdownLabel.value}` : `Pomodoro ${pomodoroCountdownLabel.value}`,
  title: isZh.value ? '番茄钟' : 'Pomodoro',
  subtitle: isZh.value ? '开始后会优先连接已绑定的 group 6 硬件，并让硬件小狗进入睡眠。' : 'Starting connects the bound group 6 hardware and puts the hardware corgi to sleep.',
  duration: isZh.value ? '专注时长' : 'Focus length',
  start: isZh.value ? '开始专注' : 'Start focus',
  stop: isZh.value ? '停止' : 'Stop',
  connect: isZh.value ? '连接硬件' : 'Connect',
  scan: isZh.value ? '扫描设备' : 'Scan',
  scanningDevices: isZh.value ? '正在扫描 group 6 设备' : 'Scanning group 6 devices',
  bound: isZh.value ? '已绑定' : 'Bound',
  unbound: isZh.value ? '未绑定设备' : 'No device bound',
  unbind: isZh.value ? '解绑' : 'Unbind',
  choose: isZh.value ? '选择' : 'Choose',
  noDevice: isZh.value ? '未发现 group 6 设备' : 'No group 6 devices found',
  ping: isZh.value ? '发送 PING' : 'Send PING',
  connected: isZh.value ? '已连接' : 'Connected',
  scanning: isZh.value ? '扫描中' : 'Scanning',
  connecting: isZh.value ? '连接中' : 'Connecting',
  idle: isZh.value ? '未连接' : 'Not connected',
  error: isZh.value ? '连接异常' : 'Link error',
  done: isZh.value ? '倒计时结束，小狗已唤醒。' : 'Timer finished. Corgi is awake.',
  localStarted: isZh.value ? '番茄钟已开始，本地倒计时继续运行。' : 'Pomodoro started. Local timer keeps running.',
}))
const pomodoroButtonLabel = computed(() => (pomodoroRunning.value ? pomodoroCopy.value.buttonRunning : pomodoroCopy.value.buttonIdle))
const pomodoroBleError = computed(() => corgiBle.lastError.value)
const pomodoroBoundDeviceLabel = computed(() => {
  const device = corgiBle.boundDevice.value
  return device ? `${pomodoroCopy.value.bound} ${device.name || device.localName || device.deviceId}` : pomodoroCopy.value.unbound
})
const pomodoroDiscoveredDevices = computed(() => corgiBle.discoveredDevices.value)
const pomodoroLinkLabel = computed(() => {
  if (corgiBle.linkState.value === 'scanning') return pomodoroCopy.value.scanning
  if (corgiBle.linkState.value === 'connecting') return pomodoroCopy.value.connecting
  if (corgiBle.linkState.value === 'connected') return `${pomodoroCopy.value.connected} ${corgiBle.connectedDeviceName.value || corgiBle.deviceName}`
  if (corgiBle.linkState.value === 'error') return pomodoroCopy.value.error
  return pomodoroCopy.value.idle
})
const calendarCursor = ref(new Date())
const yearCalendarVisible = ref(false)
const yearCursor = ref(new Date().getFullYear())
const selectedCalendarDate = ref(todayDate())
const dateActionVisible = ref(false)
const markedDates = ref<string[]>([])
const markedDateSet = computed(() => new Set(markedDates.value))
const calendarHeader = computed(() => {
  const now = calendarNow.value
  return now.toLocaleString(isZh.value ? 'zh-CN' : 'en-US', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
})
const calendarCopy = computed(() => ({
  live: isZh.value ? '实时日历' : 'Live calendar',
  openYear: isZh.value ? '全年' : 'Year',
  today: isZh.value ? '今天' : 'Today',
  prevWeek: isZh.value ? '上一周' : 'Previous week',
  nextWeek: isZh.value ? '下一周' : 'Next week',
  prevYear: isZh.value ? '上一年' : 'Prev year',
  nextYear: isZh.value ? '下一年' : 'Next year',
  close: isZh.value ? '关闭' : 'Close',
  createTask: isZh.value ? '创建待办' : 'Create todo',
  createDdl: isZh.value ? '创建 DDL' : 'Create DDL',
  mark: isZh.value ? '标记日期' : 'Mark date',
  unmark: isZh.value ? '取消标记' : 'Unmark',
  tasks: isZh.value ? '当天事项' : 'Plans on this date',
  noTasks: isZh.value ? '这一天还没有安排，可以新建一个轻量待办。' : 'No plans yet. Add a light todo for this date.',
  dateLabel: isZh.value ? '日期' : 'Date',
  timeLabel: isZh.value ? '提醒时间' : 'Reminder time',
  ddlTimeLabel: isZh.value ? 'DDL 时间' : 'DDL time',
  optionalDate: isZh.value ? '选择日期（可选）' : 'Choose date (optional)',
  clearDate: isZh.value ? '清除日期' : 'Clear date',
  marked: isZh.value ? '已标记' : 'Marked',
}))
const calendarRangeLabel = computed(() => {
  const start = new Date(calendarCursor.value)
  start.setDate(start.getDate() - 2)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const locale = isZh.value ? 'zh-CN' : 'en-US'
  const formatter = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })
  return `${formatter.format(start)} - ${formatter.format(end)}`
})
const calendarTasksForDate = (iso: string) =>
  tasks.value.filter((task) => {
    if (task.dueDate) {
      return task.dueDate === iso
    }
    return task.repeatType === 'daily'
  })
const selectedCalendarTasks = computed(() =>
  calendarTasksForDate(selectedCalendarDate.value)
    .slice()
    .sort((left, right) => `${left.dueDate ?? ''} ${left.time}`.localeCompare(`${right.dueDate ?? ''} ${right.time}`)),
)
const syncedCalendarDays = computed(() => {
  const base = calendarCursor.value
  const todayIso = toIsoDate(calendarNow.value)
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(base)
    date.setDate(base.getDate() + index - 2)
    const iso = toIsoDate(date)
    const dayTasks = calendarTasksForDate(iso).filter((task) => task.status !== 'completed')
    return {
      iso,
      day: date.getDate(),
      weekday: date.toLocaleDateString(isZh.value ? 'zh-CN' : 'en-US', { weekday: 'short' }),
      active: iso === todayIso,
      selected: iso === selectedCalendarDate.value,
      marked: markedDateSet.value.has(iso),
      count: dayTasks.length,
    }
  })
})
const defaultIconForKind = (kind: TaskKind) => (kind === 'ddl' ? '⏰' : '📋')
const weekHeaders = computed(() =>
  Array.from({ length: 7 }, (_, index) => {
    const date = new Date(2026, 0, 4 + index)
    return date.toLocaleDateString(isZh.value ? 'zh-CN' : 'en-US', { weekday: 'short' })
  }),
)
const yearCalendarMonths = computed(() =>
  Array.from({ length: 12 }, (_, monthIndex) => {
    const firstDay = new Date(yearCursor.value, monthIndex, 1)
    const daysInMonth = new Date(yearCursor.value, monthIndex + 1, 0).getDate()
    const todayIso = toIsoDate(calendarNow.value)
    const blanks = Array.from({ length: firstDay.getDay() }, () => null)
    const days = Array.from({ length: daysInMonth }, (_, dayIndex) => {
      const date = new Date(yearCursor.value, monthIndex, dayIndex + 1)
      const iso = toIsoDate(date)
      return {
        iso,
        day: dayIndex + 1,
        today: iso === todayIso,
        selected: iso === selectedCalendarDate.value,
        marked: markedDateSet.value.has(iso),
        count: calendarTasksForDate(iso).filter((task) => task.status !== 'completed').length,
      }
    })
    const cells = [...blanks, ...days]
    while (cells.length % 7 !== 0) cells.push(null)
    return {
      key: `${yearCursor.value}-${monthIndex + 1}`,
      name: firstDay.toLocaleDateString(isZh.value ? 'zh-CN' : 'en-US', { month: 'long' }),
      cells,
    }
  }),
)
const defaultBorderForKind = (kind: TaskKind) => (kind === 'ddl' ? colorOptions[2] : colorOptions[0])

const toStyledCard = (task: Task, index: number): StyledTaskCard => {
  const meta = categoryMeta.value[task.category] ?? categoryMeta.value.life

  return {
    ...task,
    categoryIcon: task.icon || meta.icon,
    categoryLabel: meta.label,
    cardBorderColor: task.borderColor || colorOptions[index % colorOptions.length],
  }
}

const isDdlTask = (task: Task) => task.kind === 'ddl'

const ddlCards = computed(() =>
  tasks.value
    .filter((task) => isDdlTask(task) && task.status !== 'completed')
    .slice()
    .sort((left, right) => `${left.dueDate ?? ''} ${left.time}`.localeCompare(`${right.dueDate ?? ''} ${right.time}`))
    .map(toStyledCard),
)

const pendingCards = computed(() => todayTasks.value.filter((task) => !isDdlTask(task)).map(toStyledCard))
const doneCards = computed(() => completedTasks.value.filter((task) => !isDdlTask(task)).map(toStyledCard))
const importedCourses = computed(() => courseSchedule.value?.courses ?? [])
const hasCourseSchedule = computed(() => importedCourses.value.length > 0)

const {
  showScheduleImporter,
  importingSchedule,
  scheduleImportError,
  openScheduleImporter,
  closeScheduleImporter,
  importScheduleFromScreenshot,
} = useCourseScheduleImporter({
  onImported: () => {
    uni.navigateTo({ url: '/pages/schedule/index' })
  },
})

const openCreateChoice = () => {
  showCreateChoice.value = true
}

const openPomodoro = () => {
  pomodoroVisible.value = true
}

const closePomodoro = () => {
  pomodoroVisible.value = false
}

const clearPomodoroTimer = () => {
  if (pomodoroTimer) clearInterval(pomodoroTimer)
  pomodoroTimer = undefined
}

const notifyPomodoroCommandFailure = (command: string, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '')
  uni.showToast({
    title: isZh.value ? `${command} 发送失败` : `${command} failed`,
    icon: 'none',
  })
  console.warn('[corgi-ble]', command, message)
}

const sendPomodoroCommand = async (command: 'START' | 'DONE' | 'PING') => {
  try {
    await corgiBle.sendCommand(command)
    return true
  } catch (error) {
    notifyPomodoroCommandFailure(command, error)
    return false
  }
}

const finishPomodoro = async () => {
  if (pomodoroEnding.value) return
  pomodoroEnding.value = true
  clearPomodoroTimer()
  pomodoroRunning.value = false
  pomodoroRemainingSeconds.value = 0
  updatePet({ state: 'normal', energy: 76 })
  triggerHardwareAction('pomodoro-done', { command: 'DONE' })
  const sent = await sendPomodoroCommand('DONE')
  if (sent) {
    uni.showToast({ title: pomodoroCopy.value.done, icon: 'none' })
  }
  pomodoroEnding.value = false
}

const startPomodoroCountdown = () => {
  clearPomodoroTimer()
  pomodoroTimer = setInterval(() => {
    if (pomodoroRemainingSeconds.value <= 1) {
      void finishPomodoro()
      return
    }
    pomodoroRemainingSeconds.value -= 1
  }, 1000)
}

const startPomodoro = async () => {
  pomodoroRemainingSeconds.value = pomodoroMinutes.value * 60
  pomodoroRunning.value = true
  pomodoroEnding.value = false
  updatePet({ state: 'resting', energy: 48 })
  triggerHardwareAction('pomodoro-start', { command: 'START', minutes: pomodoroMinutes.value })
  startPomodoroCountdown()
  const sent = await sendPomodoroCommand('START')
  if (sent) {
    uni.showToast({ title: pomodoroCopy.value.localStarted, icon: 'none' })
  }
}

const stopPomodoro = async () => {
  clearPomodoroTimer()
  pomodoroRunning.value = false
  pomodoroRemainingSeconds.value = 0
  updatePet({ state: 'normal', energy: 70 })
  triggerHardwareAction('pomodoro-stop', { command: 'DONE' })
  await sendPomodoroCommand('DONE')
}

const selectPomodoroDuration = (event: { detail: { value: number | string } }) => {
  const index = Number(event.detail.value)
  pomodoroMinutes.value = pomodoroDurationOptions[index] ?? 25
  if (!pomodoroRunning.value) {
    pomodoroRemainingSeconds.value = pomodoroMinutes.value * 60
  }
}

const connectPomodoroDevice = async () => {
  const connected = await corgiBle.connect()
  uni.showToast({
    title: connected ? (isZh.value ? '硬件已连接' : 'Hardware connected') : (isZh.value ? '连接失败' : 'Connection failed'),
    icon: 'none',
  })
}

const scanPomodoroDevices = async () => {
  pomodoroScanningDevices.value = true
  await corgiBle.scanDevices()
  pomodoroScanningDevices.value = false
}

const bindPomodoroDevice = async (device: MiniProgramBleDevice) => {
  const connected = await corgiBle.bindDevice(device)
  uni.showToast({
    title: connected ? (isZh.value ? '已绑定并连接' : 'Bound and connected') : (isZh.value ? '绑定后连接失败' : 'Bind failed'),
    icon: 'none',
  })
}

const unbindPomodoroDevice = async () => {
  await corgiBle.unbindDevice()
  uni.showToast({ title: isZh.value ? '已解绑' : 'Unbound', icon: 'none' })
}

const pingPomodoroDevice = async () => {
  await sendPomodoroCommand('PING')
}

const closeCreateChoice = () => {
  showCreateChoice.value = false
}

const openSchedulePage = () => {
  if (!hasCourseSchedule.value) {
    openScheduleImporter()
    return
  }

  uni.navigateTo({ url: '/pages/schedule/index' })
}

const readMarkedDates = () => {
  if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') {
    return
  }
  const stored = uni.getStorageSync(MARKED_CALENDAR_DATES_KEY) as unknown
  markedDates.value = Array.isArray(stored)
    ? stored.filter((value): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)).slice(0, 500)
    : []
}

const persistMarkedDates = () => {
  if (typeof uni === 'undefined' || typeof uni.setStorageSync !== 'function') {
    return
  }
  uni.setStorageSync(MARKED_CALENDAR_DATES_KEY, markedDates.value)
}

const shiftCalendarWeek = (offset: number) => {
  const nextDate = new Date(calendarCursor.value)
  nextDate.setDate(nextDate.getDate() + offset * 7)
  calendarCursor.value = nextDate
}

const jumpCalendarToday = () => {
  const today = new Date()
  calendarNow.value = today
  calendarCursor.value = today
  selectedCalendarDate.value = toIsoDate(today)
}

const openYearCalendar = () => {
  yearCursor.value = calendarCursor.value.getFullYear()
  yearCalendarVisible.value = true
}

const closeYearCalendar = () => {
  yearCalendarVisible.value = false
}

const shiftYearCalendar = (offset: number) => {
  yearCursor.value += offset
}

const openDateActions = (iso: string) => {
  selectedCalendarDate.value = iso
  calendarCursor.value = parseIsoDate(iso)
  dateActionVisible.value = true
}

const closeDateActions = () => {
  dateActionVisible.value = false
}

const toggleMarkedDate = () => {
  const iso = selectedCalendarDate.value
  if (markedDateSet.value.has(iso)) {
    markedDates.value = markedDates.value.filter((date) => date !== iso)
  } else {
    markedDates.value = [iso, ...markedDates.value].slice(0, 500)
  }
  persistMarkedDates()
}

const createCalendarTask = (kind: TaskKind) => {
  const iso = selectedCalendarDate.value || todayDate()
  closeDateActions()
  closeYearCalendar()
  openEditor('create', kind)
  formDate.value = iso
  formTime.value = kind === 'ddl' ? '23:59' : '09:00'
}

const formatCalendarDateLabel = (iso: string) => {
  const date = parseIsoDate(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(isZh.value ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })
}

const openEditor = (mode: EditorMode, kind: TaskKind, task?: Task) => {
  const fallbackCategory = kind === 'ddl' ? 'schedule' : 'work'
  const fallbackMeta = categoryMeta.value[task?.category ?? fallbackCategory]

  editorMode.value = mode
  editorKind.value = kind
  editingTaskId.value = task?.id ?? ''
  formTitle.value = task?.title ?? ''
  formDate.value = task?.dueDate || (kind === 'ddl' ? todayDate() : '')
  formTime.value = task?.time || (kind === 'ddl' ? '23:59' : '09:00')
  formIcon.value = task?.icon || fallbackMeta?.icon || defaultIconForKind(kind)
  formBorderColor.value = task?.borderColor || defaultBorderForKind(kind)
  showCreateChoice.value = false
  editorVisible.value = true
}

const closeEditor = () => {
  editorVisible.value = false
  editingTaskId.value = ''
  formTitle.value = ''
  formDate.value = ''
  formTime.value = ''
}

const chooseCreateKind = (kind: TaskKind) => {
  openEditor('create', kind)
}

const submitEditor = () => {
  const title = formTitle.value.trim()
  if (!title) {
    uni.showToast({ title: t.value.planner.titleRequired, icon: 'none' })
    return
  }

  if (editorKind.value === 'ddl' && !formDate.value) {
    uni.showToast({ title: t.value.planner.dateRequired, icon: 'none' })
    return
  }

  const sharedPayload = {
    title,
    kind: editorKind.value,
    icon: formIcon.value,
    borderColor: formBorderColor.value,
    dueDate: formDate.value,
    time: formTime.value || (editorKind.value === 'ddl' ? '23:59' : '09:00'),
  }

  if (editorMode.value === 'edit' && editingTaskId.value) {
    updateTask(editingTaskId.value, sharedPayload)
  } else {
    createTask({
      ...sharedPayload,
      notes: '',
      category: editorKind.value === 'ddl' ? 'schedule' : 'work',
      time: sharedPayload.time,
      repeatType: 'once',
      rewardType: 'mood',
      priority: 'medium',
      isStarred: false,
      subtasks: [],
    })
  }

  closeEditor()
}

const confirmDeleteTask = () => {
  if (editorMode.value !== 'edit' || !editingTaskId.value) {
    return
  }

  confirmDeleteById(editingTaskId.value, formTitle.value, closeEditor)
}

const confirmDeleteById = (taskId: string, title: string, onDeleted?: () => void) => {
  uni.showModal({
    title: deleteLabel,
    content: title,
    confirmText: deleteLabel,
    cancelText: t.value.planner.cancel,
    confirmColor: '#b84b4b',
    success: (result) => {
      if (!result.confirm) {
        return
      }

      deleteTask(taskId)
      onDeleted?.()
      uni.showToast({ title: deleteLabel, icon: 'none' })
    },
  })
}

const completeTask = (taskId: string) => {
  const result = completeTaskWithReward(taskId)
  uni.showToast({
    title: result?.awarded ? `+${result.amount} ${coinLabel.value}` : rewardClaimedLabel.value,
    icon: 'none',
  })
}

const undoCompleteTask = (taskId: string) => {
  setTaskStatus(taskId, 'pending')
}

onShow(() => {
  const now = new Date()
  calendarNow.value = now
  calendarCursor.value = now
  selectedCalendarDate.value = toIsoDate(now)
  readMarkedDates()
  void syncTasksFromCloud()
})

calendarTimer = setInterval(() => {
  calendarNow.value = new Date()
}, 30000)

onBeforeUnmount(() => {
  if (calendarTimer) clearInterval(calendarTimer)
  calendarTimer = undefined
  clearPomodoroTimer()
})
</script>

<template>
  <view class="planner-punch-page">
    <button class="planner-punch-create planner-punch-create--corner" @click="openCreateChoice">{{ t.planner.create }}</button>

    <view class="planner-live-calendar">
      <view class="planner-live-calendar__head">
        <view class="planner-live-calendar__headline" @click="openYearCalendar">
        <view class="planner-live-calendar__eyebrow">{{ isZh ? '实时日历' : 'Live calendar' }}</view>
        <view class="planner-live-calendar__time">{{ calendarHeader }}</view>
          <view class="planner-live-calendar__range">{{ calendarRangeLabel }}</view>
        </view>
        <view class="planner-live-calendar__controls">
          <button class="planner-live-calendar__nav" :aria-label="calendarCopy.prevWeek" @click.stop="shiftCalendarWeek(-1)">‹</button>
          <button class="planner-live-calendar__year" @click.stop="openYearCalendar">{{ calendarCopy.openYear }}</button>
          <button class="planner-live-calendar__nav" :aria-label="calendarCopy.nextWeek" @click.stop="shiftCalendarWeek(1)">›</button>
        </view>
      </view>
      <view class="planner-live-calendar__days">
        <button
          v-for="day in syncedCalendarDays"
          :key="day.iso"
          class="planner-live-calendar__day"
          :class="{
            'planner-live-calendar__day--active': day.active,
            'planner-live-calendar__day--selected': day.selected,
            'planner-live-calendar__day--marked': day.marked,
          }"
          @click.stop="openDateActions(day.iso)"
        >
          <view class="planner-live-calendar__weekday">{{ day.weekday }}</view>
          <view class="planner-live-calendar__date">{{ day.day }}</view>
          <view class="planner-live-calendar__count">{{ day.count }}</view>
        </button>
      </view>
    </view>

    <button class="planner-pomodoro-button" :class="{ 'planner-pomodoro-button--running': pomodoroRunning }" @click="openPomodoro">
      {{ pomodoroButtonLabel }}
    </button>

    <view class="planner-punch-board">
      <view class="planner-punch-section planner-punch-ddl-section">
        <view class="planner-punch-section__title">{{ t.planner.ddl }}</view>
        <view v-if="ddlCards.length" class="planner-punch-ddl-list">
          <view
            v-for="task in ddlCards"
            :key="task.id"
            class="planner-punch-ddl-item"
            :style="{ borderColor: task.cardBorderColor }"
            @click="openEditor('edit', 'ddl', task)"
          >
            <view class="planner-punch-ddl-item__icon">{{ task.categoryIcon }}</view>
            <view class="planner-punch-ddl-item__main">
              <view>{{ task.title }}</view>
            </view>
            <view class="planner-punch-ddl-item__date">{{ task.dueDate }} {{ task.time }}</view>
          </view>
        </view>
        <view v-else class="planner-punch-ddl-empty">{{ t.planner.noDdl }}</view>
      </view>

      <view class="planner-punch-section">
        <view class="planner-punch-section__title">{{ t.planner.pending }}</view>
        <view v-if="pendingCards.length" class="planner-punch-grid planner-punch-grid--pending">
          <view
            v-for="task in pendingCards"
            :key="task.id"
            class="planner-punch-card"
            :style="{ borderColor: task.cardBorderColor }"
            @click="openEditor('edit', 'task', task)"
          >
            <view class="planner-punch-card__body">
              <view class="planner-punch-card__icon">{{ task.categoryIcon }}</view>
              <view class="planner-punch-card__title">{{ task.title }}</view>
              <button class="planner-punch-check" :aria-label="t.planner.complete" @click.stop="completeTask(task.id)" />
            </view>
          </view>
        </view>
        <view v-else class="planner-punch-empty">{{ t.planner.pendingEmpty }}</view>
      </view>

      <view class="planner-punch-section">
        <view class="planner-punch-section__title">{{ t.planner.done }}</view>
        <view v-if="doneCards.length" class="planner-punch-grid">
          <view
            v-for="task in doneCards"
            :key="task.id"
            class="planner-punch-card planner-punch-card--done"
            :style="{ borderColor: task.cardBorderColor }"
            @click="openEditor('edit', 'task', task)"
          >
            <view class="planner-punch-card__body">
              <view class="planner-punch-card__icon">{{ task.categoryIcon }}</view>
              <view class="planner-punch-card__title">{{ task.title }}</view>
              <button class="planner-punch-undo" :aria-label="t.planner.undoComplete" @click.stop="undoCompleteTask(task.id)">↺</button>
            </view>
          </view>
        </view>
        <view v-else class="planner-punch-empty">{{ t.planner.doneEmpty }}</view>
      </view>
    </view>

    <button class="planner-schedule-fab" @click="openSchedulePage">{{ t.planner.schedule }}</button>

    <view v-if="showCreateChoice" class="planner-punch-choice-mask" @click="closeCreateChoice">
      <view class="planner-punch-choice" @click.stop>
        <button @click="chooseCreateKind('ddl')">{{ t.planner.createDdl }}</button>
        <button @click="chooseCreateKind('task')">{{ t.planner.createTask }}</button>
      </view>
    </view>

    <view v-if="pomodoroVisible" class="planner-pomodoro-mask" @click="closePomodoro">
      <view class="planner-pomodoro-card" @click.stop>
        <button class="planner-pomodoro-card__close" @click="closePomodoro">×</button>
        <view class="planner-pomodoro-card__title">{{ pomodoroCopy.title }}</view>
        <view class="planner-pomodoro-card__subtitle">{{ pomodoroCopy.subtitle }}</view>
        <view class="planner-pomodoro-card__timer">{{ pomodoroRunning ? pomodoroCountdownLabel : `${pomodoroMinutes}:00` }}</view>
        <view class="planner-pomodoro-card__status">{{ pomodoroLinkLabel }}</view>
        <view class="planner-pomodoro-card__binding">
          <view>{{ pomodoroBoundDeviceLabel }}</view>
          <button v-if="corgiBle.boundDevice.value" class="planner-pomodoro-card__mini" @click="unbindPomodoroDevice">{{ pomodoroCopy.unbind }}</button>
        </view>

        <view class="planner-pomodoro-card__label">{{ pomodoroCopy.duration }}</view>
        <picker
          mode="selector"
          :range="pomodoroDurationLabels"
          :value="pomodoroDurationIndex"
          :disabled="pomodoroRunning"
          @change="selectPomodoroDuration"
        >
          <view class="planner-pomodoro-card__picker">{{ pomodoroMinutes }} min</view>
        </picker>

        <view class="planner-pomodoro-card__actions">
          <button class="planner-pomodoro-card__primary" :disabled="pomodoroRunning" @click="startPomodoro">{{ pomodoroCopy.start }}</button>
          <button class="planner-pomodoro-card__ghost" :disabled="!pomodoroRunning" @click="stopPomodoro">{{ pomodoroCopy.stop }}</button>
        </view>
        <view class="planner-pomodoro-card__actions planner-pomodoro-card__actions--secondary">
          <button class="planner-pomodoro-card__ghost" @click="connectPomodoroDevice">{{ pomodoroCopy.connect }}</button>
          <button class="planner-pomodoro-card__ghost" @click="pingPomodoroDevice">{{ pomodoroCopy.ping }}</button>
        </view>
        <view class="planner-pomodoro-card__actions planner-pomodoro-card__actions--secondary">
          <button class="planner-pomodoro-card__ghost planner-pomodoro-card__ghost--wide" :disabled="pomodoroScanningDevices" @click="scanPomodoroDevices">
            {{ pomodoroScanningDevices ? pomodoroCopy.scanningDevices : pomodoroCopy.scan }}
          </button>
        </view>
        <view v-if="pomodoroDiscoveredDevices.length" class="planner-pomodoro-card__devices">
          <view v-for="device in pomodoroDiscoveredDevices" :key="device.deviceId" class="planner-pomodoro-card__device">
            <view>
              <view class="planner-pomodoro-card__device-name">{{ device.name || device.localName || device.deviceId }}</view>
              <view class="planner-pomodoro-card__device-id">{{ device.deviceId }}</view>
            </view>
            <button class="planner-pomodoro-card__mini" @click="bindPomodoroDevice(device)">{{ pomodoroCopy.choose }}</button>
          </view>
        </view>
        <view v-else-if="!pomodoroScanningDevices && !corgiBle.boundDevice.value" class="planner-pomodoro-card__empty">{{ pomodoroCopy.noDevice }}</view>
        <view v-if="pomodoroBleError" class="planner-pomodoro-card__error">{{ pomodoroBleError }}</view>
      </view>
    </view>

    <view v-if="showScheduleImporter" class="planner-punch-choice-mask" @click="closeScheduleImporter">
      <view class="planner-schedule-importer" @click.stop>
        <view class="planner-punch-editor__title">{{ t.planner.scheduleTitle }}</view>
        <view class="planner-schedule-importer__copy">{{ t.planner.scheduleImporterCopy }}</view>
        <button class="planner-schedule-importer__primary" :disabled="importingSchedule" @click="importScheduleFromScreenshot">
          {{ importingSchedule ? t.planner.recognizing : t.planner.importSchedule }}
        </button>
        <button class="planner-schedule-importer__ghost" :disabled="importingSchedule" @click="closeScheduleImporter">{{ t.planner.cancel }}</button>
        <view v-if="scheduleImportError" class="planner-schedule-importer__error">{{ scheduleImportError }}</view>
      </view>
    </view>

    <view v-if="yearCalendarVisible" class="planner-year-mask" @click="closeYearCalendar">
      <view class="planner-year-panel" @click.stop>
        <view class="planner-year-panel__head">
          <button class="planner-year-panel__close" @click="closeYearCalendar">×</button>
          <button class="planner-year-panel__nav" :aria-label="calendarCopy.prevYear" @click="shiftYearCalendar(-1)">‹</button>
          <view class="planner-year-panel__title">{{ yearCursor }}</view>
          <button class="planner-year-panel__nav" :aria-label="calendarCopy.nextYear" @click="shiftYearCalendar(1)">›</button>
        </view>
        <scroll-view scroll-y class="planner-year-panel__scroll">
          <view class="planner-year-grid">
            <view v-for="month in yearCalendarMonths" :key="month.key" class="planner-year-month">
              <view class="planner-year-month__title">{{ month.name }}</view>
              <view class="planner-year-month__week">
                <view v-for="weekday in weekHeaders" :key="`${month.key}-${weekday}`">{{ weekday }}</view>
              </view>
              <view class="planner-year-month__days">
                <button
                  v-for="(cell, cellIndex) in month.cells"
                  :key="cell ? cell.iso : `${month.key}-blank-${cellIndex}`"
                  class="planner-year-cell"
                  :class="{
                    'planner-year-cell--blank': !cell,
                    'planner-year-cell--today': cell && cell.today,
                    'planner-year-cell--selected': cell && cell.selected,
                    'planner-year-cell--marked': cell && cell.marked,
                  }"
                  :disabled="!cell"
                  @click.stop="cell && openDateActions(cell.iso)"
                >
                  <view v-if="cell" class="planner-year-cell__day">{{ cell.day }}</view>
                  <view v-if="cell && cell.count" class="planner-year-cell__count">{{ cell.count }}</view>
                </button>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <view v-if="dateActionVisible" class="planner-date-mask" @click="closeDateActions">
      <view class="planner-date-card" @click.stop>
        <button class="planner-date-card__close" @click="closeDateActions">×</button>
        <view class="planner-date-card__title">{{ formatCalendarDateLabel(selectedCalendarDate) }}</view>
        <view v-if="markedDateSet.has(selectedCalendarDate)" class="planner-date-card__mark">{{ calendarCopy.marked }}</view>
        <view class="planner-date-card__actions">
          <button class="planner-date-card__primary" @click="createCalendarTask('task')">{{ calendarCopy.createTask }}</button>
          <button class="planner-date-card__primary planner-date-card__primary--ddl" @click="createCalendarTask('ddl')">{{ calendarCopy.createDdl }}</button>
          <button class="planner-date-card__ghost" @click="toggleMarkedDate">
            {{ markedDateSet.has(selectedCalendarDate) ? calendarCopy.unmark : calendarCopy.mark }}
          </button>
        </view>
        <view class="planner-date-card__section">{{ calendarCopy.tasks }}</view>
        <view v-if="selectedCalendarTasks.length" class="planner-date-card__tasks">
          <view v-for="task in selectedCalendarTasks" :key="task.id" class="planner-date-task" @click="openEditor('edit', task.kind || 'task', task)">
            <view class="planner-date-task__title">{{ task.title }}</view>
            <view class="planner-date-task__meta">{{ task.time }} · {{ task.status }}</view>
          </view>
        </view>
        <view v-else class="planner-date-card__empty">{{ calendarCopy.noTasks }}</view>
      </view>
    </view>

    <view v-if="editorVisible" class="planner-punch-editor-mask" @click="closeEditor">
      <view class="planner-punch-editor" @click.stop>
        <view class="planner-punch-editor__handle" />
        <view class="planner-punch-editor__title">
          {{ editorMode === 'create' ? t.planner.newLabel : t.planner.editLabel }}{{ editorKind === 'ddl' ? ' DDL' : t.planner.task }}
        </view>
        <input v-model="formTitle" class="planner-punch-editor__input" :placeholder="t.planner.titlePlaceholder" />
        <view class="planner-punch-editor__field-row">
          <view class="planner-punch-editor__label">{{ calendarCopy.dateLabel }}</view>
          <picker mode="date" :value="formDate || todayDate()" @change="formDate = $event.detail.value">
            <view class="planner-punch-editor__date">{{ formDate || (editorKind === 'ddl' ? t.planner.chooseDate : calendarCopy.optionalDate) }}</view>
          </picker>
          <button v-if="editorKind !== 'ddl' && formDate" class="planner-punch-editor__mini" @click.stop="formDate = ''">{{ calendarCopy.clearDate }}</button>
        </view>

        <view class="planner-punch-editor__field-row">
          <view class="planner-punch-editor__label">{{ editorKind === 'ddl' ? calendarCopy.ddlTimeLabel : calendarCopy.timeLabel }}</view>
          <picker mode="time" :value="formTime || (editorKind === 'ddl' ? '23:59' : '09:00')" @change="formTime = $event.detail.value">
            <view class="planner-punch-editor__date">{{ formTime || (editorKind === 'ddl' ? '23:59' : '09:00') }}</view>
          </picker>
        </view>

        <view class="planner-punch-editor__label">{{ t.planner.icon }}</view>
        <view class="planner-punch-picker-row">
          <button
            v-for="icon in iconOptions"
            :key="icon"
            class="planner-punch-icon-option"
            :class="{ 'planner-punch-icon-option--active': formIcon === icon }"
            @click="formIcon = icon"
          >
            {{ icon }}
          </button>
        </view>

        <view class="planner-punch-editor__label">{{ t.planner.borderColor }}</view>
        <view class="planner-punch-picker-row">
          <button
            v-for="color in colorOptions"
            :key="color"
            class="planner-punch-color-option"
            :class="{ 'planner-punch-color-option--active': formBorderColor === color }"
            :style="{ background: color }"
            @click="formBorderColor = color"
          />
        </view>

        <view class="planner-punch-editor__actions" :class="{ 'planner-punch-editor__actions--with-delete': editorMode === 'edit' }">
          <button v-if="editorMode === 'edit'" class="planner-punch-editor__danger" @click.stop="confirmDeleteTask">{{ deleteLabel }}</button>
          <button class="planner-punch-editor__ghost" @click="closeEditor">{{ t.planner.cancel }}</button>
          <button class="planner-punch-editor__primary" @click="submitEditor">{{ t.planner.save }}</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useCourseScheduleImporter } from '../composables/useCourseScheduleImporter'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'
import type { ScheduleCourse, ScheduleWeekday } from '../types/koko'

type ScheduleSlot = {
  key: string
  label: string
  minutes: number
  row: number
}

type ScheduleCell = {
  key: string
  weekday: ScheduleWeekday
  slot: ScheduleSlot
}

type CourseLayout = {
  course: ScheduleCourse
  style: string
}

type DragTarget = {
  weekday: ScheduleWeekday
  slotKey: string
  minutes: number
}

type DragOrigin = {
  weekday: ScheduleWeekday
  minutes: number
}

const DEFAULT_START_MINUTES = 9 * 60
const DEFAULT_END_MINUTES = 19 * 60
const SLOT_MINUTES = 30
const TIME_COLUMN_WIDTH = 68
const DAY_COLUMN_WIDTH = 88
const ROW_HEIGHT = 35
const HEADER_HEIGHT = 48
const DEFAULT_NAV_HEIGHT = 118
const NAV_ROW_HEIGHT = 52
const NAV_ROW_GAP = 8

const { courseSchedule, setCourseSchedule } = useKokoState()
const { t } = useLanguage()
const {
  showScheduleImporter,
  importingSchedule,
  scheduleImportError,
  openScheduleImporter,
  closeScheduleImporter,
  importScheduleFromScreenshot,
} = useCourseScheduleImporter()

const dragCourseId = ref('')
const activeDragCourseId = ref('')
const dragTarget = ref<DragTarget | null>(null)
const dragGhostX = ref(0)
const dragGhostY = ref(0)
const scrollLeft = ref(0)
const scrollTop = ref(0)
const scheduleNavHeight = ref(DEFAULT_NAV_HEIGHT)
let dragOrigin: DragOrigin | null = null
let dragStartX = 0
let dragStartY = 0
let latestDragX = 0
let latestDragY = 0

const weekdayColumns = computed<Array<{ key: ScheduleWeekday; label: string }>>(() =>
  t.value.schedule.weekdays.map((label, index) => ({
    key: (index + 1) as ScheduleWeekday,
    label,
  })),
)

const importedCourses = computed(() => courseSchedule.value?.courses ?? [])
const hasCourseSchedule = computed(() => importedCourses.value.length > 0)

const parseTimeToMinutes = (value: string) => {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null
  }

  return hours * 60 + minutes
}

const formatMinutes = (value: number) => {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, Math.round(value)))
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

const floorToSlot = (value: number) => Math.floor(value / SLOT_MINUTES) * SLOT_MINUTES
const ceilToSlot = (value: number) => Math.ceil(value / SLOT_MINUTES) * SLOT_MINUTES
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const scheduleBounds = computed(() => {
  const startCandidates = importedCourses.value
    .map((course) => parseTimeToMinutes(course.startTime))
    .filter((value): value is number => value !== null)
  const endCandidates = importedCourses.value
    .map((course) => parseTimeToMinutes(course.endTime))
    .filter((value): value is number => value !== null)

  const start = Math.min(DEFAULT_START_MINUTES, ...startCandidates)
  const end = Math.max(DEFAULT_END_MINUTES, ...endCandidates)

  return {
    start: floorToSlot(start),
    end: ceilToSlot(end),
  }
})

const scheduleSlots = computed<ScheduleSlot[]>(() => {
  const slots: ScheduleSlot[] = []
  for (let minutes = scheduleBounds.value.start; minutes <= scheduleBounds.value.end; minutes += SLOT_MINUTES) {
    slots.push({
      key: formatMinutes(minutes),
      label: formatMinutes(minutes),
      minutes,
      row: slots.length + 2,
    })
  }
  return slots
})

const scheduleCells = computed<ScheduleCell[]>(() =>
  scheduleSlots.value.slice(0, -1).flatMap((slot) =>
    weekdayColumns.value.map((weekday) => ({
      key: `${weekday.key}-${slot.key}`,
      weekday: weekday.key,
      slot,
    })),
  ),
)

const targetCellKey = computed(() => (dragTarget.value ? `${dragTarget.value.weekday}-${dragTarget.value.slotKey}` : ''))
const activeDragCourse = computed(() => importedCourses.value.find((course) => course.id === activeDragCourseId.value))
const dragGhostStyle = computed(() =>
  [
    `left: ${dragGhostX.value}px`,
    `top: ${dragGhostY.value}px`,
    `width: ${DAY_COLUMN_WIDTH - 12}px`,
  ].join('; '),
)

const schedulePageStyle = computed(() => `padding-top: ${scheduleNavHeight.value}px`)
const scheduleBodyStyle = computed(() => `height: calc(100vh - ${scheduleNavHeight.value}px)`)
const scheduleTopbarStyle = computed(() => `height: ${scheduleNavHeight.value}px`)

const scheduleTrackStyle = computed(() => {
  const bodyRows = Math.max(1, scheduleSlots.value.length - 1)
  return [
    `grid-template-columns: ${TIME_COLUMN_WIDTH}px repeat(7, ${DAY_COLUMN_WIDTH}px)`,
    `grid-template-rows: ${HEADER_HEIGHT}px repeat(${bodyRows}, ${ROW_HEIGHT}px)`,
    `min-width: ${TIME_COLUMN_WIDTH + DAY_COLUMN_WIDTH * 7}px`,
  ].join('; ')
})

const getCourseDuration = (course: ScheduleCourse) => {
  const start = parseTimeToMinutes(course.startTime)
  const end = parseTimeToMinutes(course.endTime)
  if (start === null || end === null || end <= start) return SLOT_MINUTES
  return end - start
}

const courseLayouts = computed<CourseLayout[]>(() =>
  importedCourses.value.map((course) => {
    const parsedStart = parseTimeToMinutes(course.startTime) ?? scheduleBounds.value.start
    const parsedEnd = parseTimeToMinutes(course.endTime) ?? parsedStart + SLOT_MINUTES
    const start = Math.max(scheduleBounds.value.start, floorToSlot(parsedStart))
    const end = Math.max(start + SLOT_MINUTES, Math.min(scheduleBounds.value.end, ceilToSlot(parsedEnd)))
    const startRow = Math.floor((start - scheduleBounds.value.start) / SLOT_MINUTES) + 2
    const endRow = Math.floor((end - scheduleBounds.value.start) / SLOT_MINUTES) + 2
    const column = Math.max(1, Math.min(7, course.weekday)) + 1

    return {
      course,
      style: [
        `grid-column: ${column}`,
        `grid-row: ${startRow} / ${endRow}`,
        `z-index: ${activeDragCourseId.value === course.id ? 12 : 3}`,
      ].join('; '),
    }
  }),
)

const touchPoint = (event: any) => {
  const touch = event?.touches?.[0] ?? event?.changedTouches?.[0]
  return {
    x: touch?.pageX ?? 0,
    y: touch?.pageY ?? 0,
  }
}

const getDragTargetFromDelta = (pageX: number, pageY: number): DragTarget | null => {
  if (!dragOrigin) return null

  const dayDelta = Math.round((pageX - dragStartX) / DAY_COLUMN_WIDTH)
  const slotDelta = Math.round((pageY - dragStartY) / ROW_HEIGHT)
  const weekday = clamp(dragOrigin.weekday + dayDelta, 1, 7) as ScheduleWeekday
  const minutes = clamp(
    dragOrigin.minutes + slotDelta * SLOT_MINUTES,
    scheduleBounds.value.start,
    Math.max(scheduleBounds.value.start, scheduleBounds.value.end - SLOT_MINUTES),
  )
  const snappedMinutes = floorToSlot(minutes)
  const slot = scheduleSlots.value.find((item) => item.minutes === snappedMinutes) ?? scheduleSlots.value[0]
  if (!slot) return null

  return {
    weekday,
    slotKey: slot.key,
    minutes: slot.minutes,
  }
}

const updateDragTarget = (pageX: number, pageY: number) => {
  dragTarget.value = getDragTargetFromDelta(pageX, pageY)
}

const beginCourseDrag = (course: ScheduleCourse, event: any) => {
  const point = touchPoint(event)
  const startMinutes = parseTimeToMinutes(course.startTime) ?? scheduleBounds.value.start
  dragOrigin = {
    weekday: course.weekday,
    minutes: floorToSlot(startMinutes),
  }
  dragStartX = point.x
  dragStartY = point.y
  latestDragX = point.x
  latestDragY = point.y
  dragCourseId.value = course.id
  activeDragCourseId.value = course.id
  dragGhostX.value = point.x
  dragGhostY.value = point.y
  updateDragTarget(point.x, point.y)
}

const activateCourseDrag = (course: ScheduleCourse, event: any) => {
  const rawPoint = touchPoint(event)
  const point = rawPoint.x || rawPoint.y ? rawPoint : { x: dragStartX, y: dragStartY }
  const startMinutes = parseTimeToMinutes(course.startTime) ?? scheduleBounds.value.start
  dragOrigin = {
    weekday: course.weekday,
    minutes: floorToSlot(startMinutes),
  }
  latestDragX = point.x
  latestDragY = point.y
  dragCourseId.value = course.id
  activeDragCourseId.value = course.id
  dragGhostX.value = point.x
  dragGhostY.value = point.y
  updateDragTarget(point.x, point.y)
  uni.vibrateShort?.({ type: 'light' })
}

const moveCourseDrag = (event: any) => {
  const point = touchPoint(event)
  if (!activeDragCourseId.value) return

  latestDragX = point.x
  latestDragY = point.y
  dragGhostX.value = point.x
  dragGhostY.value = point.y
  updateDragTarget(point.x, point.y)
}

const commitCourseDrag = async (courseId: string, target: DragTarget | null) => {
  activeDragCourseId.value = ''
  dragCourseId.value = ''
  dragTarget.value = null
  dragOrigin = null

  if (!courseId || !target || !courseSchedule.value) return

  const course = importedCourses.value.find((item) => item.id === courseId)
  if (!course) return

  const duration = getCourseDuration(course)
  const nextStartTime = formatMinutes(target.minutes)
  const nextEndTime = formatMinutes(target.minutes + duration)

  if (course.weekday === target.weekday && course.startTime === nextStartTime) return

  const nextCourses = importedCourses.value.map((item) =>
    item.id === courseId
      ? {
          ...item,
          weekday: target.weekday,
          startTime: nextStartTime,
          endTime: nextEndTime,
        }
      : item,
  )

  await setCourseSchedule({
    ...courseSchedule.value,
    courses: nextCourses,
    importedAt: new Date().toISOString(),
  })
}

const finishCourseDrag = () => {
  const courseId = activeDragCourseId.value || dragCourseId.value
  const target = dragTarget.value

  if (target) {
    void commitCourseDrag(courseId, target)
    return
  }

  void commitCourseDrag(courseId, getDragTargetFromDelta(latestDragX, latestDragY))
}

const handleScheduleScroll = (event: any) => {
  scrollLeft.value = Number(event?.detail?.scrollLeft ?? 0)
  scrollTop.value = Number(event?.detail?.scrollTop ?? 0)
}

const syncScheduleNavHeight = () => {
  try {
    const systemInfo = uni.getSystemInfoSync?.()
    const statusBarHeight = Number(systemInfo?.statusBarHeight ?? 0)
    const wxApi = (globalThis as {
      wx?: {
        getMenuButtonBoundingClientRect?: () => { bottom?: number; height?: number; top?: number }
      }
    }).wx
    const menuButton = wxApi?.getMenuButtonBoundingClientRect?.()
    const menuBottom = Number(menuButton?.bottom ?? 0)
    const menuTop = Number(menuButton?.top ?? 0)
    const menuHeight = Number(menuButton?.height ?? 0)
    const nativeNavBottom = menuBottom || (menuTop && menuHeight ? menuTop + menuHeight : statusBarHeight + 44)

    scheduleNavHeight.value = Math.max(DEFAULT_NAV_HEIGHT, Math.ceil(nativeNavBottom + NAV_ROW_GAP + NAV_ROW_HEIGHT))
  } catch {
    scheduleNavHeight.value = DEFAULT_NAV_HEIGHT
  }
}

const backToPlanner = () => {
  const pageStack = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  if (pageStack.length > 1) {
    uni.navigateBack()
    return
  }

  uni.switchTab({ url: '/pages/planner/index' })
}

onMounted(() => {
  syncScheduleNavHeight()
})
</script>

<template>
  <view class="planner-schedule-page" :style="schedulePageStyle">
    <view class="planner-schedule-topbar" :style="scheduleTopbarStyle">
      <button class="planner-schedule-back" :aria-label="t.schedule.back" @click="backToPlanner" />
      <view class="planner-schedule-title">{{ t.schedule.title }}</view>
      <button class="planner-schedule-change planner-schedule-change--top" @click="openScheduleImporter">{{ t.schedule.change }}</button>
    </view>

    <view v-if="hasCourseSchedule" class="planner-schedule-page-body" :style="scheduleBodyStyle">
      <scroll-view
        class="planner-schedule-grid planner-schedule-grid--page"
        :scroll-x="!activeDragCourseId"
        :scroll-y="!activeDragCourseId"
        enhanced
        :show-scrollbar="false"
        @scroll="handleScheduleScroll"
      >
        <view class="planner-schedule-track" :style="scheduleTrackStyle">
          <view class="planner-schedule-head planner-schedule-time-head">{{ t.schedule.time }}</view>
          <view
            v-for="weekday in weekdayColumns"
            :key="weekday.key"
            class="planner-schedule-head"
            :style="`grid-column: ${weekday.key + 1}; grid-row: 1`"
          >
            {{ weekday.label }}
          </view>

          <view
            v-for="slot in scheduleSlots.slice(0, -1)"
            :key="slot.key"
            class="planner-schedule-time"
            :style="`grid-column: 1; grid-row: ${slot.row}`"
          >
            {{ slot.label }}
          </view>

          <view
            v-for="cell in scheduleCells"
            :key="cell.key"
            class="planner-schedule-cell"
            :class="{ 'planner-schedule-cell--target': targetCellKey === cell.key }"
            :style="`grid-column: ${cell.weekday + 1}; grid-row: ${cell.slot.row}`"
          />

          <view
            v-for="layout in courseLayouts"
            :key="layout.course.id"
            class="planner-schedule-course"
            :class="{ 'planner-schedule-course--dragging': activeDragCourseId === layout.course.id }"
            :style="layout.style"
            @touchstart.stop="beginCourseDrag(layout.course, $event)"
            @touchmove.stop.prevent="moveCourseDrag"
            @touchend.stop="finishCourseDrag"
            @touchcancel.stop="finishCourseDrag"
            @longpress.stop.prevent="activateCourseDrag(layout.course, $event)"
            @longtap.stop.prevent="activateCourseDrag(layout.course, $event)"
          >
            <view class="planner-schedule-course__name">{{ layout.course.name }}</view>
            <view v-if="layout.course.teacher" class="planner-schedule-course__meta">{{ layout.course.teacher }}</view>
            <view v-if="layout.course.location" class="planner-schedule-course__meta">{{ layout.course.location }}</view>
            <view v-if="layout.course.weeks" class="planner-schedule-course__meta">{{ layout.course.weeks }}</view>
            <view class="planner-schedule-course__meta">{{ layout.course.startTime }} - {{ layout.course.endTime }}</view>
          </view>
        </view>
      </scroll-view>

      <view v-if="activeDragCourse" class="planner-schedule-course-drag-ghost" :style="dragGhostStyle">
        <view class="planner-schedule-course__name">{{ activeDragCourse.name }}</view>
        <view v-if="activeDragCourse.location" class="planner-schedule-course__meta">{{ activeDragCourse.location }}</view>
        <view class="planner-schedule-course__meta">{{ activeDragCourse.startTime }} - {{ activeDragCourse.endTime }}</view>
      </view>
    </view>

    <view v-else class="planner-schedule-empty-page">
      <view class="planner-schedule-empty-page__title">{{ t.schedule.emptyTitle }}</view>
      <view class="planner-schedule-empty-page__copy">{{ t.schedule.emptyCopy }}</view>
      <button class="planner-schedule-change" @click="openScheduleImporter">{{ t.schedule.importSchedule }}</button>
    </view>

    <view v-if="showScheduleImporter" class="planner-punch-choice-mask" @click="closeScheduleImporter">
      <view class="planner-schedule-importer" @click.stop>
        <view class="planner-punch-editor__title">{{ t.schedule.title }}</view>
        <view class="planner-schedule-importer__copy">{{ t.schedule.importerCopy }}</view>
        <button class="planner-schedule-importer__primary" :disabled="importingSchedule" @click="importScheduleFromScreenshot">
          {{ importingSchedule ? t.schedule.recognizing : t.schedule.importSchedule }}
        </button>
        <button class="planner-schedule-importer__ghost" :disabled="importingSchedule" @click="closeScheduleImporter">{{ t.schedule.cancel }}</button>
        <view v-if="scheduleImportError" class="planner-schedule-importer__error">{{ scheduleImportError }}</view>
      </view>
    </view>
  </view>
</template>

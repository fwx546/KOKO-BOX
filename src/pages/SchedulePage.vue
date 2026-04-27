<script setup lang="ts">
import { computed } from 'vue'
import { useCourseScheduleImporter } from '../composables/useCourseScheduleImporter'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'
import type { ScheduleCourse, ScheduleWeekday } from '../types/koko'

type ScheduleCell = {
  weekday: ScheduleWeekday
  courses: ScheduleCourse[]
}

type ScheduleRow = {
  key: string
  timeLabel: string
  cells: ScheduleCell[]
}

const { courseSchedule } = useKokoState()
const { t } = useLanguage()
const {
  showScheduleImporter,
  importingSchedule,
  scheduleImportError,
  openScheduleImporter,
  closeScheduleImporter,
  importScheduleFromScreenshot,
} = useCourseScheduleImporter()

const weekdayColumns = computed<Array<{ key: ScheduleWeekday; label: string }>>(() =>
  t.value.schedule.weekdays.map((label, index) => ({
    key: (index + 1) as ScheduleWeekday,
    label,
  })),
)

const importedCourses = computed(() => courseSchedule.value?.courses ?? [])
const hasCourseSchedule = computed(() => importedCourses.value.length > 0)

const scheduleRows = computed<ScheduleRow[]>(() => {
  const slots = Array.from(
    new Set(importedCourses.value.map((course) => `${course.startTime}-${course.endTime}`).filter((slot) => slot !== '-')),
  ).sort()

  return slots.map((slot) => {
    const [startTime, endTime] = slot.split('-')

    return {
      key: slot,
      timeLabel: `${startTime}\n${endTime}`,
      cells: weekdayColumns.value.map((weekday) => ({
        weekday: weekday.key,
        courses: importedCourses.value.filter(
          (course) => course.weekday === weekday.key && course.startTime === startTime && course.endTime === endTime,
        ),
      })),
    }
  })
})

const backToPlanner = () => {
  const pageStack = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  if (pageStack.length > 1) {
    uni.navigateBack()
    return
  }

  uni.switchTab({ url: '/pages/planner/index' })
}
</script>

<template>
  <view class="planner-schedule-page">
    <view class="planner-schedule-topbar">
      <button class="planner-schedule-back" :aria-label="t.schedule.back" @click="backToPlanner">←</button>
      <view class="planner-schedule-title">{{ t.schedule.title }}</view>
      <button class="planner-schedule-change planner-schedule-change--top" @click="openScheduleImporter">{{ t.schedule.change }}</button>
    </view>

    <view v-if="hasCourseSchedule" class="planner-schedule-page-body">
      <view class="planner-schedule-grid planner-schedule-grid--page">
        <view class="planner-schedule-head planner-schedule-time-head">{{ t.schedule.time }}</view>
        <view v-for="weekday in weekdayColumns" :key="weekday.key" class="planner-schedule-head">
          {{ weekday.label }}
        </view>
        <template v-for="row in scheduleRows" :key="row.key">
          <view class="planner-schedule-time">{{ row.timeLabel }}</view>
          <view v-for="cell in row.cells" :key="`${row.key}-${cell.weekday}`" class="planner-schedule-cell">
            <view v-for="course in cell.courses" :key="course.id" class="planner-schedule-course">
              <view class="planner-schedule-course__name">{{ course.name }}</view>
              <view v-if="course.location" class="planner-schedule-course__meta">{{ course.location }}</view>
              <view v-if="course.weeks" class="planner-schedule-course__meta">{{ course.weeks }}</view>
            </view>
          </view>
        </template>
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

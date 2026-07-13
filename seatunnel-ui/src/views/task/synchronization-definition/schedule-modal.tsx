/* @author: zhjj */
/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { defineComponent, PropType, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NCheckboxGroup,
  NCollapse,
  NCollapseItem,
  NDataTable,
  NDatePicker,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NPagination,
  NSelect,
  NSpace,
  NSpin,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  NTooltip
} from 'naive-ui'
import { useMessage } from 'naive-ui'
import {
  getJobSchedule,
  getJobScheduleHistory,
  saveJobSchedule,
  updateJobScheduleEnabled
} from '@/service/sync-task-definition'
import { translateMessage } from '@/utils/message'
import {renderSyncTaskStatusTag, isSyncTaskFailureStatus} from '../synchronization-instance/status-display'
import TitleIcon from '@/assets/title-icon.png'
import './index.css'
type ScheduleRow = {
  id: number
  name: string
}

const props = {
  show: {
    type: Boolean as PropType<boolean>,
    default: false
  },
  row: {
    type: Object as PropType<ScheduleRow | null>,
    default: null
  }
}

const DEFAULT_PAGE_SIZE = 10
const WEEK_DAY_OPTIONS = [
  { label: '周一', value: 'MON' },
  { label: '周二', value: 'TUE' },
  { label: '周三', value: 'WED' },
  { label: '周四', value: 'THU' },
  { label: '周五', value: 'FRI' },
  { label: '周六', value: 'SAT' },
  { label: '周日', value: 'SUN' }
]
const WEEK_DAY_ORDER = WEEK_DAY_OPTIONS.map((item) => item.value)
const CRON_TEMPLATE_OPTIONS = [
  { label: '每天固定时间', value: 'DAILY_AT' },
  { label: '每周指定星期几', value: 'WEEKLY_DAYS_AT' },
  { label: '工作日固定时间', value: 'WEEKDAYS_AT' },
  { label: '周末固定时间', value: 'WEEKENDS_AT' },
  { label: '每月第一天固定时间', value: 'MONTH_FIRST_AT' },
  { label: '每月最后一天固定时间', value: 'MONTH_LAST_AT' },
  { label: '每季度第一天固定时间', value: 'QUARTER_FIRST_AT' },
  { label: '每季度最后一天固定时间', value: 'QUARTER_LAST_AT' },
  { label: '每年第一天固定时间', value: 'YEAR_FIRST_AT' },
  { label: '每年最后一天固定时间', value: 'YEAR_LAST_AT' },
  { label: '每隔几小时', value: 'EVERY_N_HOURS' },
  { label: '每隔几分钟', value: 'EVERY_N_MINUTES' },
  { label: '每隔几秒', value: 'EVERY_N_SECONDS' },
  { label: '手动输入', value: 'CUSTOM' }
]
const CRON_FIELD_LABEL_STYLE = {
  width: '30px',
  flexShrink: 0
}
const CRON_FIELD_INPUT_STYLE = {
  width: '132px'
}
const CRON_FIELD_ROW_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  width: '170px'
}
const CRON_FIELD_GROUP_STYLE = {
  alignItems: 'flex-start'
}

const ScheduleModal = defineComponent({
  name: 'ScheduleModal',
  props,
  emits: ['cancel', 'saved'],
  setup(props, ctx) {
    const { t } = useI18n()
    const message = useMessage()
    const formRef = ref()
    const activeTab = ref('config')
    const loading = ref(false)
    const saving = ref(false)
    const historyLoading = ref(false)
    const historyPage = ref(1)
    const historyPageSize = ref(DEFAULT_PAGE_SIZE)
    const historyTotalPage = ref(1)
    const historyData = ref<any[]>([])
    const advancedExpandedNames = ref<string[]>([])
    const cronTemplate = reactive({
      type: 'DAILY_AT',
      hour: 0,
      minute: 0,
      second: 0,
      interval: 1,
      weekDays: ['MON'] as string[]
    })

    const formModel = reactive({
      id: null as number | null,
      jobDefineId: null as number | null,
      cronExpression: '',
      enabled: false,
      activeStartTime: null as string | null,
      activeEndTime: null as string | null,
      nextTriggerTime: '',
      lastTriggerTime: '',
      lastScheduleStatus: '',
      lastScheduleMessage: ''
    })

    const rules = {
      cronExpression: {
        required: true,
        trigger: ['input', 'blur'],
        validator: (_rule: any, value: string) => {
          if (!value?.trim()) {
            return Error(
              t('project.synchronization_definition.schedule_cron_required')
            )
          }
        }
      }
    }

    const scheduleColumns = [
      {
        title: t('project.synchronization_definition.schedule_trigger_time'),
        key: 'triggerTime',
        width: '200px',
        render: (row: any) => (
          <NTooltip trigger='hover'>
            {{
              trigger: () => (
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>{row.triggerTime || '-'}</span>
              ),
              default: () => row.triggerTime || '-'
            }}
          </NTooltip>
        )
      },
      {
        title: t('project.synchronization_definition.schedule_status'),
        key: 'status',
        width: '120px',
        render: (row: any) => renderSyncTaskStatusTag(row.status, t)
      },
      {
        title: t('project.synchronization_definition.schedule_write_row_count'),
        key: 'writeRowCount',
        width: '150px',
        render: (row: any) =>
          row.writeRowCount === null || row.writeRowCount === undefined
            ? '-'
            : row.writeRowCount
      },
      {
  title: t('project.synchronization_definition.schedule_error_message'),
  key: 'errorMessage',
  width: '250px',
  ellipsis: true, 
  render: (row: any) => (
    <NTooltip trigger="hover" inverted>
      {{
        trigger: () => (
          <span
            style={{
              display: "inline-block",
              maxWidth: "240px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {isSyncTaskFailureStatus(row.status) && row.errorMessage
              ? translateMessage(row.errorMessage)
              :"-"}
          </span>
        ),
        default: () =>
          isSyncTaskFailureStatus(row.status) && row.errorMessgae
            ?translateMessage(row.errorMessage)
            : "-"
      }}
    </NTooltip>
  )
},
      {
        title: t('project.synchronization_definition.schedule_instance_id'),
        key: 'jobInstanceId',
        width: '150px',
        render: (row: any) => (
          <NTooltip trigger='hover'>
            {{
              trigger: () => (
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>{row.jobInstanceId || '-'}</span>
              ),
              default: () => row.jobInstanceId || '-'
            }}
          </NTooltip>
        )
      },
      {
        title: t('project.synchronization_definition.schedule_message'),
        key: 'message',
        width: '250px',
        render: (row: any) => (
          <NTooltip trigger='hover'>
            {{
              trigger: () => (
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>{row.message ? translateMessage(row.message) : '-'}</span>
              ),
              default: () => row.message ? translateMessage(row.message) : '-'
            }}
          </NTooltip>
        )
      }
    ]

    const normalizeValue = (value: number | null, min: number, max: number) => {
      const numericValue = Number.isFinite(value as number)
        ? Number(value)
        : min
      return Math.min(Math.max(numericValue, min), max)
    }

    const normalizeWeekDays = (weekDays: string[]) => {
      const distinctValues = Array.from(
        new Set(weekDays.filter((day) => WEEK_DAY_ORDER.includes(day)))
      )
      const sortedValues = WEEK_DAY_ORDER.filter((day) =>
        distinctValues.includes(day)
      )
      return sortedValues.length ? sortedValues : ['MON']
    }

    const buildCronExpression = () => {
      const hour = normalizeValue(cronTemplate.hour, 0, 23)
      const minute = normalizeValue(cronTemplate.minute, 0, 59)
      const second = normalizeValue(cronTemplate.second, 0, 59)
      const interval = normalizeValue(cronTemplate.interval, 1, 59)

      switch (cronTemplate.type) {
        case 'DAILY_AT':
          return `${second} ${minute} ${hour} * * ?`
        case 'WEEKLY_DAYS_AT':
          return `${second} ${minute} ${hour} ? * ${normalizeWeekDays(
            cronTemplate.weekDays
          ).join(',')}`
        case 'WEEKDAYS_AT':
          return `${second} ${minute} ${hour} ? * MON-FRI`
        case 'WEEKENDS_AT':
          return `${second} ${minute} ${hour} ? * SAT,SUN`
        case 'MONTH_FIRST_AT':
          return `${second} ${minute} ${hour} 1 * ?`
        case 'MONTH_LAST_AT':
          return `${second} ${minute} ${hour} L * ?`
        case 'QUARTER_FIRST_AT':
          return `${second} ${minute} ${hour} 1 1/3 ?`
        case 'QUARTER_LAST_AT':
          return `${second} ${minute} ${hour} L 3,6,9,12 ?`
        case 'YEAR_FIRST_AT':
          return `${second} ${minute} ${hour} 1 1 ?`
        case 'YEAR_LAST_AT':
          return `${second} ${minute} ${hour} L 12 ?`
        case 'EVERY_N_HOURS':
          return `${second} ${minute} 0/${interval} * * ?`
        case 'EVERY_N_MINUTES':
          return `${second} 0/${interval} * * * ?`
        case 'EVERY_N_SECONDS':
          return `0/${interval} * * * * ?`
        default:
          return formModel.cronExpression
      }
    }

    const syncCronTemplateFromExpression = (expression: string) => {
      const cronExpression = expression.trim().toUpperCase()
      if (!cronExpression) {
        cronTemplate.type = 'CUSTOM'
        return
      }

      let match = cronExpression.match(
        /^(\d{1,2}) (\d{1,2}) (\d{1,2}) \* \* \?$/
      )
      if (match) {
        Object.assign(cronTemplate, {
          type: 'DAILY_AT',
          second: Number(match[1]),
          minute: Number(match[2]),
          hour: Number(match[3])
        })
        return
      }

      match = cronExpression.match(
        /^(\d{1,2}) (\d{1,2}) (\d{1,2}) \? \* ((?:MON|TUE|WED|THU|FRI|SAT|SUN)(?:,(?:MON|TUE|WED|THU|FRI|SAT|SUN))*)$/
      )
      if (match) {
        const weekDays = match[4].split(',')
        const type =
          match[4] === 'MON-FRI'
            ? 'WEEKDAYS_AT'
            : match[4] === 'SAT,SUN'
            ? 'WEEKENDS_AT'
            : 'WEEKLY_DAYS_AT'
        Object.assign(cronTemplate, {
          type,
          second: Number(match[1]),
          minute: Number(match[2]),
          hour: Number(match[3]),
          weekDays: normalizeWeekDays(weekDays)
        })
        return
      }

      match = cronExpression.match(
        /^(\d{1,2}) (\d{1,2}) (\d{1,2}) \? \* MON-FRI$/
      )
      if (match) {
        Object.assign(cronTemplate, {
          type: 'WEEKDAYS_AT',
          second: Number(match[1]),
          minute: Number(match[2]),
          hour: Number(match[3]),
          weekDays: ['MON', 'TUE', 'WED', 'THU', 'FRI']
        })
        return
      }

      match = cronExpression.match(
        /^(\d{1,2}) (\d{1,2}) (\d{1,2}) \? \* SAT,SUN$/
      )
      if (match) {
        Object.assign(cronTemplate, {
          type: 'WEEKENDS_AT',
          second: Number(match[1]),
          minute: Number(match[2]),
          hour: Number(match[3]),
          weekDays: ['SAT', 'SUN']
        })
        return
      }

      match = cronExpression.match(/^(\d{1,2}) (\d{1,2}) (\d{1,2}) 1 \* \?$/)
      if (match) {
        Object.assign(cronTemplate, {
          type: 'MONTH_FIRST_AT',
          second: Number(match[1]),
          minute: Number(match[2]),
          hour: Number(match[3])
        })
        return
      }

      match = cronExpression.match(/^(\d{1,2}) (\d{1,2}) (\d{1,2}) L \* \?$/)
      if (match) {
        Object.assign(cronTemplate, {
          type: 'MONTH_LAST_AT',
          second: Number(match[1]),
          minute: Number(match[2]),
          hour: Number(match[3])
        })
        return
      }

      match = cronExpression.match(/^(\d{1,2}) (\d{1,2}) (\d{1,2}) 1 1\/3 \?$/)
      if (match) {
        Object.assign(cronTemplate, {
          type: 'QUARTER_FIRST_AT',
          second: Number(match[1]),
          minute: Number(match[2]),
          hour: Number(match[3])
        })
        return
      }

      match = cronExpression.match(
        /^(\d{1,2}) (\d{1,2}) (\d{1,2}) L 3,6,9,12 \?$/
      )
      if (match) {
        Object.assign(cronTemplate, {
          type: 'QUARTER_LAST_AT',
          second: Number(match[1]),
          minute: Number(match[2]),
          hour: Number(match[3])
        })
        return
      }

      match = cronExpression.match(/^(\d{1,2}) (\d{1,2}) (\d{1,2}) 1 1 \?$/)
      if (match) {
        Object.assign(cronTemplate, {
          type: 'YEAR_FIRST_AT',
          second: Number(match[1]),
          minute: Number(match[2]),
          hour: Number(match[3])
        })
        return
      }

      match = cronExpression.match(/^(\d{1,2}) (\d{1,2}) (\d{1,2}) L 12 \?$/)
      if (match) {
        Object.assign(cronTemplate, {
          type: 'YEAR_LAST_AT',
          second: Number(match[1]),
          minute: Number(match[2]),
          hour: Number(match[3])
        })
        return
      }

      match = cronExpression.match(
        /^(\d{1,2}) (\d{1,2}) 0\/(\d{1,2}) \* \* \?$/
      )
      if (match) {
        Object.assign(cronTemplate, {
          type: 'EVERY_N_HOURS',
          second: Number(match[1]),
          minute: Number(match[2]),
          interval: Number(match[3])
        })
        return
      }

      match = cronExpression.match(/^(\d{1,2}) 0\/(\d{1,2}) \* \* \* \?$/)
      if (match) {
        Object.assign(cronTemplate, {
          type: 'EVERY_N_MINUTES',
          second: Number(match[1]),
          interval: Number(match[2])
        })
        return
      }

      match = cronExpression.match(/^0\/(\d{1,2}) \* \* \* \* \?$/)
      if (match) {
        Object.assign(cronTemplate, {
          type: 'EVERY_N_SECONDS',
          interval: Number(match[1])
        })
        return
      }

      cronTemplate.type = 'CUSTOM'
    }

    const buildCronDescription = () => {
      const hour = String(normalizeValue(cronTemplate.hour, 0, 23)).padStart(
        2,
        '0'
      )
      const minute = String(
        normalizeValue(cronTemplate.minute, 0, 59)
      ).padStart(2, '0')
      const second = String(
        normalizeValue(cronTemplate.second, 0, 59)
      ).padStart(2, '0')
      const interval = normalizeValue(cronTemplate.interval, 1, 59)
      const selectedWeekDays = WEEK_DAY_OPTIONS.filter((item) =>
        normalizeWeekDays(cronTemplate.weekDays).includes(item.value)
      )
        .map((item) => item.label)
        .join('、')

      switch (cronTemplate.type) {
        case 'DAILY_AT':
          return `每天 ${hour}:${minute}:${second} 执行`
        case 'WEEKLY_DAYS_AT':
          return `每周${
            selectedWeekDays || '一'
          } ${hour}:${minute}:${second} 执行`
        case 'WEEKDAYS_AT':
          return `每个工作日 ${hour}:${minute}:${second} 执行`
        case 'WEEKENDS_AT':
          return `每个周末 ${hour}:${minute}:${second} 执行`
        case 'MONTH_FIRST_AT':
          return `每月第一天 ${hour}:${minute}:${second} 执行`
        case 'MONTH_LAST_AT':
          return `每月最后一天 ${hour}:${minute}:${second} 执行`
        case 'QUARTER_FIRST_AT':
          return `每季度第一天 ${hour}:${minute}:${second} 执行`
        case 'QUARTER_LAST_AT':
          return `每季度最后一天 ${hour}:${minute}:${second} 执行`
        case 'YEAR_FIRST_AT':
          return `每年第一天 ${hour}:${minute}:${second} 执行`
        case 'YEAR_LAST_AT':
          return `每年最后一天 ${hour}:${minute}:${second} 执行`
        case 'EVERY_N_HOURS':
          return `每隔 ${interval} 小时，在第 ${minute} 分 ${second} 秒执行`
        case 'EVERY_N_MINUTES':
          return `每隔 ${interval} 分钟，在第 ${second} 秒执行`
        case 'EVERY_N_SECONDS':
          return `每隔 ${interval} 秒执行`
        default:
          return ''
      }
    }

    const applyCronTemplate = () => {
      if (cronTemplate.type === 'CUSTOM') {
        return
      }
      formModel.cronExpression = buildCronExpression()
    }

    const handleCronExpressionChange = (value: string) => {
      formModel.cronExpression = value
      syncCronTemplateFromExpression(value)
    }

    const resetState = () => {
      activeTab.value = 'config'
      historyPage.value = 1
      historyPageSize.value = DEFAULT_PAGE_SIZE
      historyTotalPage.value = 1
      historyData.value = []
      advancedExpandedNames.value = []
      Object.assign(cronTemplate, {
        type: 'DAILY_AT',
        hour: 0,
        minute: 0,
        second: 0,
        interval: 1,
        weekDays: ['MON']
      })
      Object.assign(formModel, {
        id: null,
        jobDefineId: props.row?.id || null,
        cronExpression: '',
        enabled: true,
        activeStartTime: null,
        activeEndTime: null,
        nextTriggerTime: '',
        lastTriggerTime: '',
        lastScheduleStatus: '',
        lastScheduleMessage: ''
      })
      applyCronTemplate()
    }

    const loadSchedule = async () => {
      if (!props.row?.id) return
      loading.value = true
      try {
        const res = await getJobSchedule(props.row.id)
        Object.assign(formModel, {
          id: res?.id || null,
          jobDefineId: props.row.id,
          cronExpression: res?.cronExpression || '',
          enabled: res?.id ? !!res?.enabled : true,
          activeStartTime: res?.activeStartTime || null,
          activeEndTime: res?.activeEndTime || null,
          nextTriggerTime: res?.nextTriggerTime || '',
          lastTriggerTime: res?.lastTriggerTime || '',
          lastScheduleStatus: res?.lastScheduleStatus || '',
          lastScheduleMessage: res?.lastScheduleMessage || ''
        })
        if (res?.cronExpression?.trim()) {
          syncCronTemplateFromExpression(res.cronExpression)
        } else {
          applyCronTemplate()
        }
      } finally {
        loading.value = false
      }
    }

    const loadHistory = async () => {
      if (!props.row?.id) return
      historyLoading.value = true
      try {
        const res = await getJobScheduleHistory({
          jobDefineId: props.row.id,
          pageNo: historyPage.value,
          pageSize: historyPageSize.value
        })
        historyData.value = res.data || []
        historyTotalPage.value = res.totalPage || 1
      } finally {
        historyLoading.value = false
      }
    }

    const handleOpen = async () => {
      resetState()
      await loadSchedule()
      await loadHistory()
    }

    const handleCancel = () => {
      ctx.emit('cancel')
    }

    const handleSave = async () => {
      await formRef.value?.validate()
      if (saving.value || !formModel.jobDefineId) return
      saving.value = true
      try {
        const res = await saveJobSchedule({
          jobDefineId: formModel.jobDefineId,
          cronExpression: formModel.cronExpression.trim(),
          enabled: formModel.enabled,
          activeStartTime: formModel.activeStartTime,
          activeEndTime: formModel.activeEndTime
        })
        Object.assign(formModel, {
          id: res?.id || formModel.id,
          cronExpression: res?.cronExpression || formModel.cronExpression,
          enabled: !!res?.enabled,
          activeStartTime: res?.activeStartTime || null,
          activeEndTime: res?.activeEndTime || null,
          nextTriggerTime: res?.nextTriggerTime || '',
          lastTriggerTime: res?.lastTriggerTime || '',
          lastScheduleStatus: res?.lastScheduleStatus || '',
          lastScheduleMessage: res?.lastScheduleMessage || ''
        })
        await loadHistory()
        message.success(t('common.success_tips'))
        ctx.emit('saved')
        ctx.emit('cancel')
      } finally {
        saving.value = false
      }
    }

    const handleEnableChange = async (value: boolean) => {
      if (!formModel.jobDefineId) return
      formModel.enabled = value
      if (!formModel.id || !formModel.cronExpression.trim()) {
        return
      }
      const res = await updateJobScheduleEnabled({
        jobDefineId: formModel.jobDefineId,
        enabled: value
      })
      Object.assign(formModel, {
        id: res?.id || formModel.id,
        enabled: !!res?.enabled,
        nextTriggerTime: res?.nextTriggerTime || '',
        lastTriggerTime: res?.lastTriggerTime || '',
        lastScheduleStatus: res?.lastScheduleStatus || '',
        lastScheduleMessage: res?.lastScheduleMessage || ''
      })
      await loadHistory()
      message.success(t('common.success_tips'))
      ctx.emit('saved')
    }

    const handleHistoryPageChange = async (page: number) => {
      historyPage.value = page
      await loadHistory()
    }

    const handleHistoryPageSizeChange = async (pageSize: number) => {
      historyPage.value = 1
      historyPageSize.value = pageSize
      await loadHistory()
    }

    const handleTemplateTypeChange = (value: string) => {
      cronTemplate.type = value
      cronTemplate.weekDays = normalizeWeekDays(cronTemplate.weekDays)
      applyCronTemplate()
    }

    watch(
      () => props.show,
      (value) => {
        if (value) {
          handleOpen()
        } else {
          resetState()
        }
      }
    )

    watch(
      () => [
        cronTemplate.type,
        cronTemplate.hour,
        cronTemplate.minute,
        cronTemplate.second,
        cronTemplate.interval,
        cronTemplate.weekDays.join(',')
      ],
      () => {
        applyCronTemplate()
      }
    )

    return {
      CRON_TEMPLATE_OPTIONS,
      WEEK_DAY_OPTIONS,
      t,
      formRef,
      activeTab,
      loading,
      saving,
      historyLoading,
      historyPage,
      historyPageSize,
      historyTotalPage,
      historyData,
      advancedExpandedNames,
      cronTemplate,
      buildCronDescription,
      normalizeWeekDays,
      formModel,
      rules,
      scheduleColumns,
      handleCancel,
      handleSave,
      handleEnableChange,
      handleCronExpressionChange,
      handleTemplateTypeChange,
      handleHistoryPageChange,
      handleHistoryPageSizeChange,
      TitleIcon
    }
  },
  render() {
    return (
      <NModal
        show={this.show}
    
        mask-closable={false}
        style={{ width: '1000px' }}
        onUpdateShow={(value) => !value && this.handleCancel()}
      >
        <NCard
          title={(
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',borderBottom:'1px solid #e5e5e5',paddingBottom:'12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2c3947', fontSize: '18px', fontWeight: 600 }}>
                <img src={TitleIcon} style={{ width: '35px', height: '35px' }} />
                <span>{`${this.t('project.synchronization_definition.schedule_title')}${this.row?.name ? ` - ${this.row.name}` : ''}`}</span>
              </div>
              <div 
                onClick={this.handleCancel}
                style={{ cursor: 'pointer', fontSize: '20px', color: '#666', lineHeight: 1 }}
              >
                ×
              </div>
            </div>
          )}
          contentStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
        >
          {{
            default: () => (
              <NSpin show={this.loading}>
                <div style={{ display: 'flex', height: '65vh' }}>
                  {/* 左侧 tab 导航 */}
                  <div style={{ 
                    width: '160px', 
                    borderRight: '1px dashed #DDE1ED',
                   
                  }}>
                    <div
                      onClick={() => this.activeTab = 'config'}
                      style={{
                        padding: '16px 20px 16px 12px',
                        cursor: 'pointer',
                        backgroundColor: this.activeTab === 'config' ? '#ffffff' : 'transparent',
                        color: this.activeTab === 'config' ? '#1960bc' : '#4b5563',
                        fontWeight: this.activeTab === 'config' ? 400 : 400,
                        display: 'flex',
                        alignItems: 'center',
                        position: 'relative'
                      }}
                    >
                      {this.activeTab === 'config' && (
                        <div style={{
                          position: 'absolute',
                          left: '0px',
                          width: '4px',
                          height: '20px',
                          backgroundColor: '#1960BC',
                          borderRadius: '2px'
                        }} />
                      )}
                      <span style={{fontSize:'16px'}}>{this.t('project.synchronization_definition.schedule_config')}  </span>
                    </div>
                    <div
                      onClick={() => this.activeTab = 'history'}
                      style={{
                        padding: '16px 20px 16px 12px',
                        cursor: 'pointer',
                        backgroundColor: this.activeTab === 'history' ? '#ffffff' : 'transparent',
                        color: this.activeTab === 'history' ? '#1960bc' : '#4b5563',
                        fontWeight: this.activeTab === 'history' ? 400 : 400,
                        display: 'flex',
                        alignItems: 'center',
                        position: 'relative'
                      }}
                    >
                      {this.activeTab === 'history' && (
                        <div style={{
                          position: 'absolute',
                          left: '0px',
                          width: '4px',
                          height: '20px',
                          backgroundColor: '#1960BC',
                          borderRadius: '2px'
                        }} />
                      )}
                     <span style={{fontSize:'16px'}}>{this.t('project.synchronization_definition.schedule_history')}  </span>  
                    </div>
                  </div>

                  {/* 右侧内容区域 */}
                  <div style={{ flex: 1, padding: '20px', overflow: 'auto', position: 'relative', zIndex: 1 }}>
                    {/* 配置 tab 内容 */}
                    {this.activeTab === 'config' && (
                      <NSpace vertical size={16}>
                        <div style={{
                          fontFamily:'PingFang SC',
                          backgroundColor: '#EDF6FF',
                          color: '#1960BC',
                          fontWeight: 500,
                          fontSize: '16px',
                          padding: '12px 16px',
                          borderRadius: '4px'
                        }}>
                          {this.t(
                            'project.synchronization_definition.schedule_cron_tip'
                          )}
                        </div>
                        <NForm
                          ref='formRef'
                          model={this.formModel}
                          rules={this.rules}
                          labelPlacement='left'
                          labelWidth={140}
                        >
                          <NFormItem
                            label={this.t(
                              'project.synchronization_definition.schedule_enabled'
                            )}
                          >
                            <NSwitch
                              value={this.formModel.enabled}
                              onUpdateValue={this.handleEnableChange}
                            />
                          </NFormItem>
                          <NFormItem
                            label={this.t(
                              'project.synchronization_definition.schedule_quick_template'
                            )}
                          >
                            <NSpace vertical size={12} style={{ width: '100%' }}>
                              <NSelect
                                value={this.cronTemplate.type}
                                options={this.CRON_TEMPLATE_OPTIONS}
                                onUpdateValue={this.handleTemplateTypeChange}
                              />
                              {this.cronTemplate.type !== 'CUSTOM' && (
                                <NSpace vertical size={12}>
                                  {[
                                    'DAILY_AT',
                                    'WEEKLY_DAYS_AT',
                                    'WEEKDAYS_AT',
                                    'WEEKENDS_AT',
                                    'MONTH_FIRST_AT',
                                    'MONTH_LAST_AT',
                                    'QUARTER_FIRST_AT',
                                    'QUARTER_LAST_AT',
                                    'YEAR_LAST_AT',
                                    'YEAR_FIRST_AT'
                                  ].includes(this.cronTemplate.type) && (
                                    <NSpace
                                      vertical
                                      size={10}
                                      style={CRON_FIELD_GROUP_STYLE}
                                    >
                                      <div style={CRON_FIELD_ROW_STYLE}>
                                        <span style={CRON_FIELD_LABEL_STYLE}>
                                          {this.t(
                                            'project.synchronization_definition.schedule_hour'
                                          )}
                                        </span>
                                        <NInputNumber
                                          value={this.cronTemplate.hour}
                                          min={0}
                                          max={23}
                                          placeholder='0-23'
                                          style={CRON_FIELD_INPUT_STYLE}
                                          onUpdateValue={(value) =>
                                            (this.cronTemplate.hour = value || 0)
                                          }
                                        />
                                      </div>
                                      <div style={CRON_FIELD_ROW_STYLE}>
                                        <span style={CRON_FIELD_LABEL_STYLE}>
                                          {this.t(
                                            'project.synchronization_definition.schedule_minute'
                                          )}
                                        </span>
                                        <NInputNumber
                                          value={this.cronTemplate.minute}
                                          min={0}
                                          max={59}
                                          placeholder='0-59'
                                          style={CRON_FIELD_INPUT_STYLE}
                                          onUpdateValue={(value) =>
                                            (this.cronTemplate.minute =
                                              value || 0)
                                          }
                                        />
                                      </div>
                                      <div style={CRON_FIELD_ROW_STYLE}>
                                        <span style={CRON_FIELD_LABEL_STYLE}>
                                          {this.t(
                                            'project.synchronization_definition.schedule_second'
                                          )}
                                        </span>
                                        <NInputNumber
                                          value={this.cronTemplate.second}
                                          min={0}
                                          max={59}
                                          placeholder='0-59'
                                          style={CRON_FIELD_INPUT_STYLE}
                                          onUpdateValue={(value) =>
                                            (this.cronTemplate.second =
                                              value || 0)
                                          }
                                        />
                                      </div>
                                    </NSpace>
                                  )}
                                  {this.cronTemplate.type ===
                                    'WEEKLY_DAYS_AT' && (
                                    <NCheckboxGroup
                                      value={this.cronTemplate.weekDays}
                                      onUpdateValue={(value) =>
                                        (this.cronTemplate.weekDays =
                                          this.normalizeWeekDays(
                                            value as string[]
                                          ))
                                      }
                                    >
                                      <NSpace>
                                        {this.WEEK_DAY_OPTIONS.map((item) => (
                                          <NCheckbox
                                            key={item.value}
                                            value={item.value}
                                            label={item.label}
                                          />
                                        ))}
                                      </NSpace>
                                    </NCheckboxGroup>
                                  )}
                                  {this.cronTemplate.type === 'EVERY_N_HOURS' && (
                                    <NSpace
                                      vertical
                                      size={10}
                                      style={CRON_FIELD_GROUP_STYLE}
                                    >
                                      <div style={CRON_FIELD_ROW_STYLE}>
                                        <span style={CRON_FIELD_LABEL_STYLE}>
                                          {this.t(
                                            'project.synchronization_definition.schedule_interval'
                                          )}
                                        </span>
                                        <NInputNumber
                                          value={this.cronTemplate.interval}
                                          min={1}
                                          max={59}
                                          placeholder='1-59'
                                          style={CRON_FIELD_INPUT_STYLE}
                                          onUpdateValue={(value) =>
                                            (this.cronTemplate.interval =
                                              value || 1)
                                          }
                                        />
                                      </div>
                                      <div style={CRON_FIELD_ROW_STYLE}>
                                        <span style={CRON_FIELD_LABEL_STYLE}>
                                          {this.t(
                                            'project.synchronization_definition.schedule_minute'
                                          )}
                                        </span>
                                        <NInputNumber
                                          value={this.cronTemplate.minute}
                                          min={0}
                                          max={59}
                                          placeholder='0-59'
                                          style={CRON_FIELD_INPUT_STYLE}
                                          onUpdateValue={(value) =>
                                            (this.cronTemplate.minute =
                                              value || 0)
                                          }
                                        />
                                      </div>
                                      <div style={CRON_FIELD_ROW_STYLE}>
                                        <span style={CRON_FIELD_LABEL_STYLE}>
                                          {this.t(
                                            'project.synchronization_definition.schedule_second'
                                          )}
                                        </span>
                                        <NInputNumber
                                          value={this.cronTemplate.second}
                                          min={0}
                                          max={59}
                                          placeholder='0-59'
                                          style={CRON_FIELD_INPUT_STYLE}
                                          onUpdateValue={(value) =>
                                            (this.cronTemplate.second =
                                              value || 0)
                                          }
                                        />
                                      </div>
                                    </NSpace>
                                  )}
                                  {this.cronTemplate.type ===
                                    'EVERY_N_MINUTES' && (
                                    <NSpace
                                      vertical
                                      size={10}
                                      style={CRON_FIELD_GROUP_STYLE}
                                    >
                                      <div style={CRON_FIELD_ROW_STYLE}>
                                        <span style={CRON_FIELD_LABEL_STYLE}>
                                          {this.t(
                                            'project.synchronization_definition.schedule_interval'
                                          )}
                                        </span>
                                        <NInputNumber
                                          value={this.cronTemplate.interval}
                                          min={1}
                                          max={59}
                                          placeholder='1-59'
                                          style={CRON_FIELD_INPUT_STYLE}
                                          onUpdateValue={(value) =>
                                            (this.cronTemplate.interval =
                                              value || 1)
                                          }
                                        />
                                      </div>
                                      <div style={CRON_FIELD_ROW_STYLE}>
                                        <span style={CRON_FIELD_LABEL_STYLE}>
                                          {this.t(
                                            'project.synchronization_definition.schedule_second'
                                          )}
                                        </span>
                                        <NInputNumber
                                          value={this.cronTemplate.second}
                                          min={0}
                                          max={59}
                                          placeholder='0-59'
                                          style={CRON_FIELD_INPUT_STYLE}
                                          onUpdateValue={(value) =>
                                            (this.cronTemplate.second =
                                              value || 0)
                                          }
                                        />
                                      </div>
                                    </NSpace>
                                  )}
                                  {this.cronTemplate.type ===
                                    'EVERY_N_SECONDS' && (
                                    <div style={CRON_FIELD_ROW_STYLE}>
                                      <span style={CRON_FIELD_LABEL_STYLE}>
                                        {this.t(
                                          'project.synchronization_definition.schedule_interval'
                                        )}
                                      </span>
                                      <NInputNumber
                                        value={this.cronTemplate.interval}
                                        min={1}
                                        max={59}
                                        placeholder='1-59'
                                        style={CRON_FIELD_INPUT_STYLE}
                                        onUpdateValue={(value) =>
                                          (this.cronTemplate.interval =
                                            value || 1)
                                        }
                                      />
                                    </div>
                                  )}
                                  <div style={{
                                    backgroundColor: '#DCDFE659',
                                    fontSize: '15px',
                                    fontWeight: 500,
                                    fontFamily: 'PingFang SC',
                                    padding: '12px 16px',
                                    borderRadius: '4px'
                                  }}>
                                    {this.t(
                                      'project.synchronization_definition.schedule_template_tip'
                                    )}
                                  </div>
                                  <div style={{
                                    backgroundColor: '#E6F9EC',
                                    fontSize: '15px',
                                    fontWeight: 500,
                                    fontFamily: 'PingFang SC',
                                    padding: '12px 16px',
                                    borderRadius: '4px'
                                  }}>
                                    {this.t(
                                      'project.synchronization_definition.schedule_generated_cron'
                                    )}
                                    : {this.formModel.cronExpression || '-'}
                                  </div>
                                  <div style={{
                                    backgroundColor: '#EFF4FB',
                                    fontSize: '15px',
                                    fontWeight: 500,
                                    fontFamily: 'PingFang SC',
                                    padding: '12px 16px',
                                    borderRadius: '4px'
                                  }}>
                                    {this.t(
                                      'project.synchronization_definition.schedule_generated_description'
                                    )}
                                    : {this.buildCronDescription()}
                                  </div>
                                </NSpace>
                              )}
                            </NSpace>
                          </NFormItem>
                          <NFormItem
                            path='cronExpression'
                            label={this.t(
                              'project.synchronization_definition.schedule_cron'
                            )}
                          >
                            <NCollapse
                              expandedNames={this.advancedExpandedNames}
                              onUpdateExpandedNames={(value) =>
                                (this.advancedExpandedNames = value as string[])
                              }
                              style={{ width: '100%' }}
                            >
                              <NCollapseItem
                                title={this.t(
                                  'project.synchronization_definition.schedule_advanced_mode'
                                )}
                                name='advanced-cron'
                              >
                                <NSpace vertical style={{ width: '100%' }}>
                                  <NAlert type='warning' showIcon={false}>
                                    {this.t(
                                      'project.synchronization_definition.schedule_advanced_tip'
                                    )}
                                  </NAlert>
                                  <NInput
                                    value={this.formModel.cronExpression}
                                    onUpdateValue={
                                      this.handleCronExpressionChange
                                    }
                                    placeholder={this.t(
                                      'project.synchronization_definition.schedule_cron_placeholder'
                                    )}
                                  />
                                </NSpace>
                              </NCollapseItem>
                            </NCollapse>
                          </NFormItem>
                          <NFormItem
                            label={this.t(
                              'project.synchronization_definition.schedule_active_start'
                            )}
                          >
                            <NSpace size={4}>
                              <input
                                type="date"
                                value={this.formModel.activeStartTime?.substring(0, 10) || ''}
                                onInput={(e: any) => {
                                  const time = (this.formModel.activeStartTime || '').substring(11) || '00:00'
                                  this.formModel.activeStartTime = e.target.value ? `${e.target.value} ${time}:00` : null
                                }}
                                style={{
                                  height: '34px',
                                  border: '1px solid #dcdfe6',
                                  borderRadius: '3px',
                                  padding: '0 8px',
                                  fontSize: '14px',
                                  color: '#333',
                                  backgroundColor: '#fff',
                                  outline: 'none',
                                  width: '140px'
                                }}
                              />
                              <input
                                type="time"
                                value={this.formModel.activeStartTime?.substring(11, 16) || ''}
                                onInput={(e: any) => {
                                  const date = (this.formModel.activeStartTime || '').substring(0, 10)
                                  if (!date) return
                                  this.formModel.activeStartTime = e.target.value ? `${date} ${e.target.value}:00` : `${date} 00:00:00`
                                }}
                                style={{
                                  height: '34px',
                                  border: '1px solid #dcdfe6',
                                  borderRadius: '3px',
                                  padding: '0 8px',
                                  fontSize: '14px',
                                  color: '#333',
                                  backgroundColor: '#fff',
                                  outline: 'none',
                                  width: '120px'
                                }}
                              />
                            </NSpace>
                          </NFormItem>
                          <NFormItem
                            label={this.t(
                              'project.synchronization_definition.schedule_active_end'
                            )}
                          >
                            <NSpace size={4}>
                              <input
                                type="date"
                                value={this.formModel.activeEndTime?.substring(0, 10) || ''}
                                onInput={(e: any) => {
                                  const time = (this.formModel.activeEndTime || '').substring(11) || '00:00'
                                  this.formModel.activeEndTime = e.target.value ? `${e.target.value} ${time}:00` : null
                                }}
                                style={{
                                  height: '34px',
                                  border: '1px solid #dcdfe6',
                                  borderRadius: '3px',
                                  padding: '0 8px',
                                  fontSize: '14px',
                                  color: '#333',
                                  backgroundColor: '#fff',
                                  outline: 'none',
                                  width: '140px'
                                }}
                              />
                              <input
                                type="time"
                                value={this.formModel.activeEndTime?.substring(11, 16) || ''}
                                onInput={(e: any) => {
                                  const date = (this.formModel.activeEndTime || '').substring(0, 10)
                                  if (!date) return
                                  this.formModel.activeEndTime = e.target.value ? `${date} ${e.target.value}:00` : `${date} 00:00:00`
                                }}
                                style={{
                                  height: '34px',
                                  border: '1px solid #dcdfe6',
                                  borderRadius: '3px',
                                  padding: '0 8px',
                                  fontSize: '14px',
                                  color: '#333',
                                  backgroundColor: '#fff',
                                  outline: 'none',
                                  width: '120px'
                                }}
                              />
                            </NSpace>
                          </NFormItem>
                        </NForm>
                        <NSpace justify='space-between'>
                          <NSpace>
                            <NTag type='info' bordered={false} style={{
                              color: '#1960BC',
                              fontFamily: 'PingFang SC',
                              fontWeight: 500,
                              fontSize: '16px',
                              height:'44px'
                            }}>
                              {this.t(
                                'project.synchronization_definition.schedule_next_trigger'
                              )}
                              : {this.formModel.nextTriggerTime || '-'}
                            </NTag>
                            <NTag
                              type={
                                this.formModel.lastScheduleStatus === 'FAILED'
                                  ? 'error'
                                  : this.formModel.lastScheduleStatus ===
                                    'SUCCESS'
                                  ? 'success'
                                  : 'default'
                              }
                              style={{
                              color: '#212B36',
                              fontFamily: 'PingFang SC',
                              fontWeight: 500,
                              fontSize: '16px',
                              height:'44px'
                            }}
                              bordered={false}
                            >
                              {this.t(
                                'project.synchronization_definition.schedule_last_status'
                              )}
                              :{' '}
                              {this.formModel.lastScheduleStatus
                                ? this.t(
                                    `project.synchronization_definition.status_${String(
                                      this.formModel.lastScheduleStatus
                                    ).toLowerCase()}`
                                  )
                                : '-'}
                            </NTag>
                          </NSpace>
                        </NSpace>
                      </NSpace>
                    )}

                    {/* 历史记录 tab 内容 */}
                    {this.activeTab === 'history' && (
                      this.historyData.length ? (
                        <NSpace vertical>
                          <NDataTable
                            columns={this.scheduleColumns}
                            data={this.historyData}
                            loading={this.historyLoading}
                            bordered
                            scrollX={1090}
                          />
                          <NSpace justify='right' style={{ width: '100%' }}>
                            <NPagination
                              page={this.historyPage}
                              page-size={this.historyPageSize}
                              page-count={this.historyTotalPage}
                              show-size-picker
                              page-sizes={[10, 30, 50]}
                              onUpdatePage={this.handleHistoryPageChange}
                              onUpdatePageSize={this.handleHistoryPageSizeChange}
                            />
                          </NSpace>
                        </NSpace>
                      ) : (
                        <NEmpty
                          description={this.t(
                            'project.synchronization_definition.schedule_history_empty'
                          )}
                        />
                      )
                    )}
                  </div>
                </div>
              </NSpin>
            ),
            footer: () => (
              <NSpace justify='end'>
                <NButton quaternary size='small' style={{ borderRadius: '4px',backgroundColor:'#f3f7fb',color:'#1960bc',height:44+'px',padding:'0 15px' }} onClick={this.handleCancel}>
                  {this.t('project.synchronization_definition.cancel')}
                </NButton>
                {this.activeTab === 'config' && (
                  <NButton
                    size='small'
                    type='primary'
                    loading={this.saving}
                    onClick={this.handleSave}
                    style={{ borderRadius: '4px',backgroundColor:'#134e9a',color:'#ffffff',height:44+'px',padding:'0 15px' }}
                  >
                    {this.t('project.synchronization_definition.save')}
                  </NButton>
                )}
              </NSpace>
            )
          }}
        </NCard>
      </NModal>
    )
  }
})

export { ScheduleModal }

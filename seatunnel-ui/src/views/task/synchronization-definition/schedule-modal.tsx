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
  NTag
} from 'naive-ui'
import { useMessage } from 'naive-ui'
import {
  getJobSchedule,
  getJobScheduleHistory,
  saveJobSchedule,
  updateJobScheduleEnabled
} from '@/service/sync-task-definition'
import { renderSyncTaskStatusTag } from '../synchronization-instance/status-display'

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
  { label: '手动输入', value: 'CUSTOM' },
  { label: '每天固定时间', value: 'DAILY_AT' },
  { label: '每周指定星期', value: 'WEEKLY_DAYS_AT' },
  { label: '工作日固定时间', value: 'WEEKDAYS_AT' },
  { label: '周末固定时间', value: 'WEEKENDS_AT' },
  { label: '每月第一天固定时间', value: 'MONTH_FIRST_AT' },
  { label: '每月最后一天固定时间', value: 'MONTH_LAST_AT' },
  { label: '每隔几小时', value: 'EVERY_N_HOURS' },
  { label: '每隔几分钟', value: 'EVERY_N_MINUTES' },
  { label: '每隔几秒', value: 'EVERY_N_SECONDS' }
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
      type: 'CUSTOM',
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
        key: 'triggerTime'
      },
      {
        title: t('project.synchronization_definition.schedule_status'),
        key: 'status',
        render: (row: any) => renderSyncTaskStatusTag(row.status, t)
      },
      {
        title: t('project.synchronization_definition.schedule_instance_id'),
        key: 'jobInstanceId',
        render: (row: any) => row.jobInstanceId || '-'
      },
      {
        title: t('project.synchronization_definition.schedule_message'),
        key: 'message',
        render: (row: any) => row.message || '-'
      }
    ]

    const normalizeValue = (value: number | null, min: number, max: number) => {
      const numericValue = Number.isFinite(value as number) ? Number(value) : min
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
          return `${second} ${minute} ${hour} ? * ${
            normalizeWeekDays(cronTemplate.weekDays).join(',')
          }`
        case 'WEEKDAYS_AT':
          return `${second} ${minute} ${hour} ? * MON-FRI`
        case 'WEEKENDS_AT':
          return `${second} ${minute} ${hour} ? * SAT,SUN`
        case 'MONTH_FIRST_AT':
          return `${second} ${minute} ${hour} 1 * ?`
        case 'MONTH_LAST_AT':
          return `${second} ${minute} ${hour} L * ?`
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

      let match = cronExpression.match(/^(\d{1,2}) (\d{1,2}) (\d{1,2}) \* \* \?$/)
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

      match = cronExpression.match(/^(\d{1,2}) (\d{1,2}) (\d{1,2}) \? \* MON-FRI$/)
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

      match = cronExpression.match(/^(\d{1,2}) (\d{1,2}) (\d{1,2}) \? \* SAT,SUN$/)
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

      match = cronExpression.match(/^(\d{1,2}) (\d{1,2}) 0\/(\d{1,2}) \* \* \?$/)
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
      const hour = String(normalizeValue(cronTemplate.hour, 0, 23)).padStart(2, '0')
      const minute = String(normalizeValue(cronTemplate.minute, 0, 59)).padStart(2, '0')
      const second = String(normalizeValue(cronTemplate.second, 0, 59)).padStart(2, '0')
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
          return `每周${selectedWeekDays || '一'} ${hour}:${minute}:${second} 执行`
        case 'WEEKDAYS_AT':
          return `每个工作日 ${hour}:${minute}:${second} 执行`
        case 'WEEKENDS_AT':
          return `每个周末 ${hour}:${minute}:${second} 执行`
        case 'MONTH_FIRST_AT':
          return `每月第一天 ${hour}:${minute}:${second} 执行`
        case 'MONTH_LAST_AT':
          return `每月最后一天 ${hour}:${minute}:${second} 执行`
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
        type: 'CUSTOM',
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
        enabled: false,
        activeStartTime: null,
        activeEndTime: null,
        nextTriggerTime: '',
        lastTriggerTime: '',
        lastScheduleStatus: '',
        lastScheduleMessage: ''
      })
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
          enabled: !!res?.enabled,
          activeStartTime: res?.activeStartTime || null,
          activeEndTime: res?.activeEndTime || null,
          nextTriggerTime: res?.nextTriggerTime || '',
          lastTriggerTime: res?.lastTriggerTime || '',
          lastScheduleStatus: res?.lastScheduleStatus || '',
          lastScheduleMessage: res?.lastScheduleMessage || ''
        })
        syncCronTemplateFromExpression(res?.cronExpression || '')
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
      formModel,
      rules,
      scheduleColumns,
      handleCancel,
      handleSave,
      handleEnableChange,
      handleCronExpressionChange,
      handleTemplateTypeChange,
      handleHistoryPageChange,
      handleHistoryPageSizeChange
    }
  },
  render() {
    return (
      <NModal
        show={this.show}
        mask-closable={false}
        style={{ width: '920px' }}
        onUpdateShow={(value) => !value && this.handleCancel()}
      >
        <NCard
          title={`${this.t(
            'project.synchronization_definition.schedule_title'
          )}${this.row?.name ? ` - ${this.row.name}` : ''}`}
          contentStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
        >
          {{
            default: () => (
              <NSpin show={this.loading}>
                <NTabs v-model:value={this.activeTab} animated>
                  <NTabPane
                    name='config'
                    tab={this.t(
                      'project.synchronization_definition.schedule_config'
                    )}
                  >
                    <NSpace vertical size={16}>
                      <NAlert type='info' showIcon={false}>
                        {this.t(
                          'project.synchronization_definition.schedule_cron_tip'
                        )}
                      </NAlert>
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
                                  'MONTH_LAST_AT'
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
                                          (this.cronTemplate.minute = value || 0)
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
                                          (this.cronTemplate.second = value || 0)
                                        }
                                      />
                                    </div>
                                  </NSpace>
                                )}
                                {this.cronTemplate.type === 'WEEKLY_DAYS_AT' && (
                                  <NCheckboxGroup
                                    value={this.cronTemplate.weekDays}
                                    onUpdateValue={(value) =>
                                      (this.cronTemplate.weekDays = normalizeWeekDays(
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
                                {[
                                  'EVERY_N_HOURS',
                                  'EVERY_N_MINUTES'
                                ].includes(this.cronTemplate.type) && (
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
                                          (this.cronTemplate.interval = value || 1)
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
                                          (this.cronTemplate.minute = value || 0)
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
                                          (this.cronTemplate.second = value || 0)
                                        }
                                      />
                                    </div>
                                  </NSpace>
                                )}
                                {this.cronTemplate.type === 'EVERY_N_SECONDS' && (
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
                                        (this.cronTemplate.interval = value || 1)
                                      }
                                    />
                                  </div>
                                )}
                                <NAlert type='default' showIcon={false}>
                                  {this.t(
                                    'project.synchronization_definition.schedule_template_tip'
                                  )}
                                </NAlert>
                                <NAlert type='success' showIcon={false}>
                                  {this.t(
                                    'project.synchronization_definition.schedule_generated_cron'
                                  )}
                                  : {this.formModel.cronExpression || '-'}
                                </NAlert>
                                <NAlert type='info' showIcon={false}>
                                  {this.t(
                                    'project.synchronization_definition.schedule_generated_description'
                                  )}
                                  : {this.buildCronDescription()}
                                </NAlert>
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
                                  onUpdateValue={this.handleCronExpressionChange}
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
                          <NDatePicker
                            v-model={[
                              this.formModel.activeStartTime,
                              'formattedValue'
                            ]}
                            type='datetime'
                            clearable
                            value-format='yyyy-MM-dd HH:mm:ss'
                            placeholder={this.t(
                              'project.synchronization_definition.schedule_active_start_placeholder'
                            )}
                          />
                        </NFormItem>
                        <NFormItem
                          label={this.t(
                            'project.synchronization_definition.schedule_active_end'
                          )}
                        >
                          <NDatePicker
                            v-model={[
                              this.formModel.activeEndTime,
                              'formattedValue'
                            ]}
                            type='datetime'
                            clearable
                            value-format='yyyy-MM-dd HH:mm:ss'
                            placeholder={this.t(
                              'project.synchronization_definition.schedule_active_end_placeholder'
                            )}
                          />
                        </NFormItem>
                      </NForm>
                      <NSpace justify='space-between'>
                        <NSpace>
                          <NTag type='info' bordered={false}>
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
                  </NTabPane>
                  <NTabPane
                    name='history'
                    tab={this.t(
                      'project.synchronization_definition.schedule_history'
                    )}
                  >
                    {this.historyData.length ? (
                      <NSpace vertical>
                        <NDataTable
                          columns={this.scheduleColumns}
                          data={this.historyData}
                          loading={this.historyLoading}
                        />
                        <NSpace justify='center'>
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
                    )}
                  </NTabPane>
                </NTabs>
              </NSpin>
            ),
            footer: () => (
              <NSpace justify='end'>
                <NButton quaternary size='small' onClick={this.handleCancel}>
                  {this.t('project.synchronization_definition.cancel')}
                </NButton>
                {this.activeTab === 'config' && (
                  <NButton
                    size='small'
                    type='primary'
                    loading={this.saving}
                    onClick={this.handleSave}
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

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

import '@iconify/iconify'
import { useI18n } from 'vue-i18n'
import { h, reactive, ref } from 'vue'
import { useTableOperation } from '@/hooks'
import { NTag, NSwitch, NSpace, NIcon, NPopconfirm } from 'naive-ui'
import {
  querySyncTaskDefinitionPaging,
  deleteSyncTaskDefinition,
  executeJob
} from '@/service/sync-task-definition'
import { useRouter } from 'vue-router'
import type { Router } from 'vue-router'
import type { JobType } from './dag/types'
import {
  COLUMN_WIDTH_CONFIG,
  calculateTableWidth
} from '@/common/column-width-config'
import { useMessage } from 'naive-ui'
import { renderSyncTaskStatusTag } from '../synchronization-instance/status-display'
import './use-table.css'

export function useTable() {
  const { t } = useI18n()
  const router: Router = useRouter()

  // 自定义 Iconify 图标组件
  const IconifyIcon = (iconName: string) => {
    return h('span', {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
      },
      class: 'iconify',
      'data-icon': iconName,
      'aria-hidden': 'true'
    })
  }
  const variables = reactive({
    columns: [],
    tableData: [],
    page: ref(1),
    pageSize: ref(10),
    searchName: ref(''),
    totalPage: ref(1),
    tableWidth: ref(0),
    showModalRef: ref(false),
    showScheduleModalRef: ref(false),
    statusRef: ref(0),
    row: {},
    scheduleRow: null,
    loadingRef: ref(false)
  })

  const JOB_TYPE = {
    DATA_REPLICA: 'whole_library_sync',
    DATA_INTEGRATION: 'data_integration'
  } as { [key in JobType]: string }

  const message = useMessage()

  const loadingStates = ref(new Map<number | string, boolean>())

  const createColumns = (
    variables: any,
    onOpenScheduleModal?: (row: any) => void
  ) => {
    variables.columns = [
      {
        title: t(
          'project.synchronization_definition.synchronization_task_name'
        ),
        key: 'name',
        ...COLUMN_WIDTH_CONFIG['name']
      },
      {
        title: t('project.synchronization_definition.business_model'),
        key: 'jobKey',
        ...COLUMN_WIDTH_CONFIG['type'],
        render: (row: { jobType: JobType }) =>
          t(`project.synchronization_definition.${JOB_TYPE[row.jobType]}`)
      },
      {
        title: t('project.synchronization_definition.task_describe'),
        key: 'description',
        ...COLUMN_WIDTH_CONFIG['description']
      },
      {
        title: t('project.synchronization_definition.create_user'),
        key: 'createUserName',
        ...COLUMN_WIDTH_CONFIG['userName']
      },
      {
        title: t('project.synchronization_definition.create_time'),
        key: 'createTime',
        ...COLUMN_WIDTH_CONFIG['time']
      },
      {
        title: t('project.synchronization_definition.update_user'),
        key: 'updateUserName',
        ...COLUMN_WIDTH_CONFIG['userName']
      },
      {
        title: t('project.synchronization_definition.update_time'),
        key: 'updateTime',
        ...COLUMN_WIDTH_CONFIG['time']
      },
      // ====================== 【状态列改成开关样式】 ======================
      {
        title: t('project.synchronization_definition.schedule_status'),
        key: 'scheduleEnabled',
        width: 120,
        render: (row: any) => {
          const enabled = row.scheduleEnabled === true
          return h(NSwitch, {
            class: 'sync-status-switch',
            value: enabled,
            disabled: true,
            checkedChildren: t('common.enabled'),
            uncheckedChildren: t('common.disabled')
          })
        }
      },
      {
        title: t('project.synchronization_definition.schedule_next_trigger'),
        key: 'scheduleNextTriggerTime',
        ...COLUMN_WIDTH_CONFIG['time'],
        render: (row: any) => row.scheduleNextTriggerTime || '-'
      },
      // ====================== 【操作列改成纯文字按钮】 ======================
      {
        title: t('project.synchronization_definition.operation'),
        key: 'operation',
        fixed: 'right',
        width: 320,
        render: (row: any) => {
          return h(NSpace, { size: 'small' }, [
            // 修改按钮
            h('a', {
              class: 'sync-operation-btn',
              onClick: () => {
                router.push({ path: `/task/synchronization-definition/${row.id}` })
              },
              style: { display: 'inline-flex', alignItems: 'center', gap: '4px',color:'#7598c4' }
            }, [IconifyIcon('line-md:edit'), t('project.synchronization_definition.edit')]),
            
            // 定时按钮
            h('a', {
              class: 'sync-operation-btn',
              onClick: () => { onOpenScheduleModal && onOpenScheduleModal(row) },
              style: { display: 'inline-flex', alignItems: 'center', gap: '4px' }
            },[IconifyIcon('material-symbols-light:timer-outline'),t('project.synchronization_definition.schedule')]) ,

            // 启动按钮
            h('a', {
              class: 'sync-operation-btn',
              onClick: () => {
                if (!loadingStates.value.get(row.id)) handleRun(row)
              },
              disabled: !!loadingStates.value.get(row.id),
              style: { display: 'inline-flex', alignItems: 'center', gap: '4px' }
            }, loadingStates.value.get(row.id)
              ? [IconifyIcon('material-symbols:play-arrow'), `${t('project.synchronization_definition.start')}...`]
              : [IconifyIcon('material-symbols:play-arrow'), t('project.synchronization_definition.start')]),

            // 删除按钮
            h(
              NPopconfirm,
              {
                negativeText: t('datasource.cancel') || t('common.cancel'),
                positiveText: t('datasource.confirm') || t('common.confirm'),
                onPositiveClick: async () => {
                  await handleDelete(row)
                }
              },
              {
                trigger: () =>
                  h('a', {
                    class: 'sync-operation-btn sync-delete-btn',
                    style: { display: 'inline-flex', alignItems: 'center', gap: '4px' }
                  }, [IconifyIcon('material-symbols:delete-outline'), t('project.synchronization_definition.delete')]),
                default: () => t('security.token.delete_confirm')
              }
            )
          ])
        }
      }
    ]

    variables.tableWidth = calculateTableWidth(variables.columns)
  }

  const getTableData = (params: any) => {
    if (variables.loadingRef) return
    variables.loadingRef = true

    querySyncTaskDefinitionPaging(params)
      .then((res: any) => {
        variables.tableData = res.data
        variables.totalPage = res.totalPage
        variables.loadingRef = false
      })
      .catch(() => {
        variables.loadingRef = false
      })
  }

  const handleRun = (row: any) => {
    loadingStates.value.set(row.id, true)

    executeJob(row.id)
      .then((res: any) => {
        message.success(t('project.synchronization_definition.start_success'))
        router.push({
          path: `/task/synchronization-instance/${row.id}`,
          query: { jobInstanceId: res, taskName: row.name }
        })
      })
      .catch(() => {
        message.error(t('project.synchronization_definition.start_failed'))
      })
      .finally(() => {
        loadingStates.value.set(row.id, false)
      })
  }

  const handleDelete = async (row: any) => {
    if (variables.tableData.length === 1 && variables.page > 1) {
      --variables.page
    }

    await deleteSyncTaskDefinition({
      projectCode: row.projectCode,
      id: row.id
    })

    getTableData({
      pageSize: variables.pageSize,
      pageNo: variables.page,
      searchName: variables.searchName
    })
  }

  return {
    variables,
    createColumns,
    getTableData
  }
}
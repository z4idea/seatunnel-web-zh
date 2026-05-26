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

import { h, reactive, ref } from 'vue'
import { endOfToday, format, startOfToday, subDays } from 'date-fns'
import { useTableOperation } from '@/hooks'
import {
  AlignLeftOutlined,
  CheckCircleOutlined,
  ClearOutlined,
  DownloadOutlined,
  SyncOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  DeleteOutlined
} from '@vicons/antd'
import { useI18n } from 'vue-i18n'
import { cleanState, downloadLog, forceSuccess } from '@/service/task-instances'
import {
  COLUMN_WIDTH_CONFIG,
  DefaultTableWidth,
  calculateTableWidth
} from '@/common/column-width-config'
import { useRoute, useRouter } from 'vue-router'
import { ITaskState } from '@/common/types'
import { tasksState } from '@/common/common'
import { NEllipsis, NIcon, NSpin, NTooltip, NSpace } from 'naive-ui'
import { useMessage } from 'naive-ui'
import {
  querySyncTaskInstancePaging,
  hanldlePauseJob,
  hanldleRecoverJob,
  hanldleDelJob,
  queryJobExecutionDetail
} from '@/service/sync-task-instance'
import type { RowKey } from 'naive-ui/lib/data-table/src/interface'
import type { Router } from 'vue-router'
import {
  cleanStateByIds,
  forcedSuccessByIds
} from '@/service/sync-task-instance'
import { getRemainTime } from '@/utils/time'
import { renderSyncTaskStatusTag } from './status-display'
import '../synchronization-definition/index.css'

export function useSyncTask(syncTaskType = 'BATCH') {
  const { t } = useI18n()
  const router: Router = useRouter()
  const route = useRoute()
  const message = useMessage()

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
    tableWidth: DefaultTableWidth,
    columns: [],
    tableData: [],
    page: ref(1),
    pageSize: ref(10),
    totalPage: ref(1),
    loadingRef: false,
    logRef: '',
    logLoadingRef: ref(true),
    showModalRef: ref(false),
    row: {},
    skipLineNum: ref(0),
    limit: ref(1000),
    taskName: ref(''),
    executeUser: ref(''),
    errorMessage: ref(''),
    showErrorMessageModal: ref(false),
    host: ref(''),
    stateType: null as null | string,
    syncTaskType,
    checkedRowKeys: [] as Array<RowKey>,
    buttonList: [],
    datePickerRange: [
      format(subDays(startOfToday(), 30), 'yyyy-MM-dd HH:mm:ss'),
      format(endOfToday(), 'yyyy-MM-dd HH:mm:ss')
    ],
    showLogViewerModal: ref(false),
    currentJobId: ref(''),
    currentJobName: ref(''),
    logNodes: [] as any[],
    selectedLogNode: ref(''),
    logContent: ref(''),
    logLoading: ref(false),
    refreshInterval: ref(5),
    autoScroll: ref(true),
    refreshTimerId: ref(0)
  })

  const creatInstanceButtons = (variables: any) => {
    variables.buttonList = [
      {
        label: t('project.task.clean_state'),
        key: 'clean_state'
      },
      {
        label: t('project.task.forced_success'),
        key: 'forced_success'
      }
    ]
  }
  //
  const createColumns = (variables: any) => {
    const taskNameColumnWidth =
      typeof COLUMN_WIDTH_CONFIG.link_name.width === 'number'
        ? COLUMN_WIDTH_CONFIG.link_name.width
        : 180
    const linkStyle =
      'display: inline-block; max-width: 100%; color: var(--n-color-target); text-decoration: none; cursor: pointer;'

    variables.columns = [
      {
        title: t('project.synchronization_definition.task_name'),
        key: 'jobDefineName',
        ...COLUMN_WIDTH_CONFIG['link_name'],
        render: (row: any) => {
          const targetRoute = {
            path: `/task/synchronization-instance/${row.jobDefineId}`,
            query: {
              jobInstanceId: row.id,
              taskName: row.jobDefineName
            }
          }

          return h(
            'a',
            {
              href: router.resolve(targetRoute).href,
              title: row.jobDefineName,
              style: linkStyle,
              onClick: (event: MouseEvent) => {
                event.preventDefault()
                router.push(targetRoute)
              }
            },
            h(
              NEllipsis,
              {
                style: `max-width: ${taskNameColumnWidth - 24}px`
              },
              () => row.jobDefineName || '-'
            )
          )
        }
      },
      {
        title: t('project.synchronization_instance.amount_of_data_read'),
        key: 'readRowCount',
        ...COLUMN_WIDTH_CONFIG['tag']
      },
      {
        title: t('project.synchronization_instance.amount_of_data_written'),
        key: 'writeRowCount',
        ...COLUMN_WIDTH_CONFIG['tag']
      },
      {
        title: t('project.synchronization_instance.execute_user'),
        key: 'username',
        width:150,
        ...COLUMN_WIDTH_CONFIG['state']
      },
      {
        title: t('project.synchronization_instance.state'),
        key: 'jobStatus',
        width: 120,
        render: (row: any) => renderSyncTaskStatusTag(row.jobStatus, t)
      },
      {
        title: t('project.synchronization_instance.error_message'),
        key: 'parameter',
        width:150,
        ...COLUMN_WIDTH_CONFIG['state'],
        render: (row: any) => {
          return row.errorMessage
            ? h(
                'a',
                {
                  href: '#',
                  title: t('tasks.view'),
                  style: linkStyle,
                  onClick: (event: MouseEvent) => {
                    event.preventDefault()
                    handleViewErrorMessage(row.errorMessage)
                  }
                },
                t('tasks.view')
              )
            : '--'
          }
      },
      {
        title: t('project.synchronization_instance.start_time'),
        key: 'createTime',
        ...COLUMN_WIDTH_CONFIG['time']
      },
      {
        title: t('project.synchronization_instance.end_time'),
        key: 'endTime',
        ...COLUMN_WIDTH_CONFIG['time']
      },
      {
        title: t('project.synchronization_instance.run_time'),
        key: 'runningTime',
        render: (row: any) => getRemainTime(row.runningTime),
        ...COLUMN_WIDTH_CONFIG['duration']
      },
      {
        title: t('project.synchronization_instance.operation'),
        key: 'operation',
        ...COLUMN_WIDTH_CONFIG['operation'](4),
        width: 320,
        render: (row: any) => {
          return h(NSpace, { size: 'small' }, [
            // 恢复按钮
            h('a', {
              class: 'sync-operation-btn',
              onClick: () => handleRecover(row.id),
              style: { display: 'inline-flex', alignItems: 'center', gap: '4px' }
            }, [IconifyIcon('material-symbols:play-arrow'), t('project.workflow.recovery_suspend')]),

            // 暂停按钮
            h('a', {
              class: 'sync-operation-btn',
              onClick: () => handlePause(row.id),
              style: { display: 'inline-flex', alignItems: 'center', gap: '4px' }
            }, [IconifyIcon('material-symbols:pause'), t('project.workflow.pause')]),

            // 查看日志按钮
            h('a', {
              class: 'sync-operation-btn',
              onClick: () => handleViewLogs(row),
              style: { display: 'inline-flex', alignItems: 'center', gap: '4px' }
            }, [IconifyIcon('material-symbols:description'), t('project.synchronization_instance.view_logs')]),

            // 删除按钮
            h('a', {
              class: 'sync-operation-btn sync-delete-btn',
              onClick: async () => {
                if (confirm(t('project.synchronization_instance.delete_confirm'))) {
                  await handleDel(row.id)
                }
              },
              style: { display: 'inline-flex', alignItems: 'center', gap: '4px' }
            }, [IconifyIcon('material-symbols:delete-outline'), t('project.synchronization_instance.delete')])
          ])
        }
      }
    ]

    if (variables.tableWidth) {
      variables.tableWidth = calculateTableWidth(variables.columns)
    }
  }

  const getTableData = (params: any) => {
    if (variables.loadingRef) return
    variables.loadingRef = true
    querySyncTaskInstancePaging(params)
      .then((res: any) => {
        variables.tableData = res.totalList as any
        variables.totalPage = res.totalPage
      })
      .catch(() => {
        variables.tableData = [] as any
      })
      .finally(() => {
        variables.loadingRef = false
      })
  }
  const handleRecover = (id: number) => {
    hanldleRecoverJob(id).then(() => {
      message.success(t('common.success_tips'))
    })
  }
  const handlePause = (id: number) => {
    hanldlePauseJob(id).then(() => {
      message.success(t('common.success_tips'))
    })
  }
  const handleDel = (id: number) => {
    hanldleDelJob(id).then(() => {
      message.success(t('common.success_tips'))
      getList()
    })
  }

  const handleLog = (row: any) => {
    variables.showModalRef = true
    variables.row = row
  }

  const handleViewErrorMessage = (errorMessage: string) => {
    variables.errorMessage = errorMessage
    variables.showErrorMessageModal = true
  }
  
  const handleViewLogs = async (row: any) => {
    variables.currentJobName = row.jobDefineName
    variables.currentJobId = row.jobEngineId || ''

    if (!variables.currentJobId) {
      try {
        const detail = await queryJobExecutionDetail({ jobInstanceId: row.id })
        variables.currentJobId = detail?.jobEngineId || ''
      } catch (err) {
        console.error('Failed to load job execution detail for logs:', err)
      }
    }

    if (!variables.currentJobId) {
      message.error(t('project.synchronization_instance.fetch_logs_error'))
      return
    }

    variables.showLogViewerModal = true
  }

  const handleCleanState = (row: any) => {
    cleanState(Number(row.projectCode), [row.id]).then(() => {
      getList()
    })
  }

  const handleForcedSuccess = (row: any) => {
    forceSuccess({ id: row.id }, { projectCode: Number(row.projectCode) }).then(
      () => {
        getList()
      }
    )
  }

  const getQueryParams = (pageNo = variables.page) => ({
    pageSize: variables.pageSize,
    pageNo,
    taskName: variables.taskName?.trim() || undefined,
    host: variables.host?.trim() || undefined,
    stateType: variables.stateType || undefined,
    startDate: variables.datePickerRange?.[0] || undefined,
    endDate: variables.datePickerRange?.[1] || undefined,
    executorName: variables.executeUser?.trim() || undefined,
    syncTaskType: variables.syncTaskType
  })

  const getList = () => {
    getTableData(
      getQueryParams(
        variables.tableData.length === 1 && variables.page > 1
          ? variables.page - 1
          : variables.page
      )
    )
  }

  const onReset = () => {
    variables.taskName = ''
    variables.executeUser = ''
    variables.host = ''
    variables.stateType = null
    variables.datePickerRange = [
      format(subDays(startOfToday(), 30), 'yyyy-MM-dd HH:mm:ss'),
      format(endOfToday(), 'yyyy-MM-dd HH:mm:ss')
    ]
  }
  const onBatchCleanState = (ids: any) => {
    cleanStateByIds(ids).then(() => {
      window.$message.success(t('project.workflow.success'))
      variables.checkedRowKeys = []
      getList()
    })
  }

  const onBatchForcedSuccess = (ids: any) => {
    forcedSuccessByIds(ids).then(() => {
      window.$message.success(t('project.workflow.success'))
      variables.checkedRowKeys = []
      getList()
    })
  }

  const batchBtnListClick = (key: string) => {
    if (variables.checkedRowKeys.length == 0) {
      window.$message.warning(t('project.select_task_instance'))
      return
    }
    switch (key) {
      case 'clean_state':
        onBatchCleanState(variables.checkedRowKeys)
        break
      case 'forced_success':
        onBatchForcedSuccess(variables.checkedRowKeys)
        break
    }
  }

  return {
    variables,
    createColumns,
    getTableData,
    getQueryParams,
    onReset,
    batchBtnListClick,
    creatInstanceButtons,
    handleViewLogs
  }
}

const renderStateCell = (state: ITaskState, t: Function) => {
  if (!state) return ''

  const stateOption = tasksState(t)[state]
  if (!stateOption) return ''
  const Icon = h(
    NIcon,
    {
      color: stateOption.color,
      class: stateOption.classNames,
      style: {
        display: 'flex'
      },
      size: 20
    },
    () => h(stateOption.icon)
  )
  return h(NTooltip, null, {
    trigger: () => {
      if (!stateOption.isSpin) return Icon
      return h(NSpin, { size: 20 }, { icon: () => Icon })
    },
    default: () => stateOption.desc
  })
}

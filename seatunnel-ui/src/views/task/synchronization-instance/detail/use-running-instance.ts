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

import { reactive, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  queryRunningInstancePaging,
  queryJobExecutionStatus
} from '@/service/sync-task-instance'
import { useRoute } from 'vue-router'
import { renderSyncTaskStatusTag } from '../status-display'

export function useRunningInstance() {
  const { t } = useI18n()
  const route = useRoute()

  const variables = reactive({
    columns: [],
    tableData: [],
    loadingRef: false,
    refreshTimer: 0 as unknown as number
  })

  const createColumns = (variables: any) => {
    variables.columns = [
      {
        title: t('project.synchronization_instance.pipeline_id'),
        key: 'pipelineId'
      },
      {
        title: t('project.synchronization_instance.source'),
        key: 'sourceTableNames'
      },
      {
        title: t('project.synchronization_instance.read_rate'),
        key: 'readQps'
      },
      {
        title: t('project.synchronization_instance.amount_of_data_read'),
        key: 'readRowCount'
      },
      {
        title: t('project.synchronization_instance.delay_of_data'),
        key: 'recordDelay',
        render: (row: any) => row.recordDelay / 1000
      },
      {
        title: t('project.synchronization_instance.sink'),
        key: 'sinkTableNames'
      },
      {
        title: t('project.synchronization_instance.processing_rate'),
        key: 'writeQps'
      },
      {
        title: t('project.synchronization_instance.amount_of_data_written'),
        key: 'writeRowCount'
      },
      {
        title: t('project.synchronization_instance.state'),
        key: 'status',
        width: 120,
        render: (row: any) => renderSyncTaskStatusTag(row.status, t)
      }
    ]
  }

  const getTableData = () => {
    if (variables.loadingRef) return
    variables.loadingRef = true

    queryRunningInstancePaging({
      jobInstanceId: route.query.jobInstanceId
    })
      .then((res: any) => {
        variables.tableData = res
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        variables.loadingRef = false
      })
  }

  const isJobEndStatus = (status?: string) => {
    if (!status) return false
    const s = String(status).toUpperCase()
    return s === 'FINISHED' || s === 'FAILED' || s === 'CANCELED'
  }

  const startAutoRefresh = () => {
    stopAutoRefresh()
    const jobInstanceId = route.query.jobInstanceId as string
    if (!jobInstanceId) return

    variables.refreshTimer = window.setInterval(async () => {
      try {
        const statusRes = await queryJobExecutionStatus({ jobInstanceId })
        if (isJobEndStatus(statusRes?.jobStatus)) {
          getTableData()
          stopAutoRefresh()
          return
        }
        getTableData()
      } catch {
        // status unavailable, still try to refresh table data
        getTableData()
      }
    }, 2000)
  }

  const stopAutoRefresh = () => {
    if (variables.refreshTimer) {
      clearInterval(variables.refreshTimer)
      variables.refreshTimer = 0 as unknown as number
    }
  }

  onUnmounted(() => {
    stopAutoRefresh()
  })

  return {
    variables,
    createColumns,
    getTableData,
    startAutoRefresh,
    stopAutoRefresh
  }
}

/*
 * @author: zhjj
 */
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

import { reactive } from 'vue'
import {
  getDefinitionConfig,
  getDefinitionDetail,
  getDefinitionNodesAndEdges,
  saveTaskDefinitionDag,
  deleteTaskDefinitionDag,
  checkDatabaseAndTable
} from '@/service/sync-task-definition'
import { useRoute, useRouter } from 'vue-router'
import { useSynchronizationDefinitionStore } from '@/store/synchronization-definition'
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { formatMessagePayload } from '@/utils/message'
import { loadDagDetailData } from './dag-detail-loader'
import type { InputPlugin, InputEdge } from './types'

export const useDagDetail = () => {
  const route = useRoute()
  const router = useRouter()
  const message = useMessage()
  const { t } = useI18n()
  const dagStore = useSynchronizationDefinitionStore()
  const state = reactive({
    loading: false
  })

  const detailInit = async () => {
    if (state.loading) return
    state.loading = true
    try {
      const result = await loadDagDetailData({
        jobDefinitionCode: route.params.jobDefinitionCode as string,
        t,
        message,
        setDagInfo: (dagInfo) => dagStore.setDagInfo(dagInfo),
        services: {
          getDefinitionNodesAndEdges,
          getDefinitionConfig,
          getDefinitionDetail,
          checkDatabaseAndTable
        }
      })

      result.sourceValidationIssues?.forEach((issue: any) => {
        if (issue.databases.length > 0) {
            message.warning(
              `(${issue.name}-${issue.pluginId})[${issue.databases.toString()}] ${t(
                'project.synchronization_definition.database_exception_message'
              )}`,
              { closable: true, duration: 0 }
            )
        }
        if (issue.tables.length > 0) {
            message.warning(
              `(${issue.name}-${issue.pluginId})[${issue.tables.toString()}] ${t(
                'project.synchronization_definition.table_exception_message'
              )}`,
              { closable: true, duration: 0 }
            )
        }
      })

      return result
    } finally {
      state.loading = false
    }
  }

  const onDelete = async (id: string): Promise<boolean> => {
    try {
      await deleteTaskDefinitionDag(
        route.params.jobDefinitionCode as string,
        id
      )
      return true
    } catch (err) {
      return false
    }
  }

  const onSave = async (
    jobDag: {
      plugins: InputPlugin[]
      edges: InputEdge[]
    },
    graph: any
  ): Promise<boolean> => {
    if (state.loading) return false
    state.loading = true
    try {
      const result = await saveTaskDefinitionDag(
        route.params.jobDefinitionCode as string,
        jobDag
      )

      if (result) {
        const node = graph.getCellById(result.pluginId)
        node.getData().isError = true
        node.getData().schemaError = result.schemaError
        graph.resetCells(graph.getCells())

        window.$message.error(formatMessagePayload(result.schemaError || ''), {
          closable: true,
          duration: 0
        })
      } else {
        router.push({
          name: 'synchronization-definition',
          query: {
            project: route.query.project,
            global: route.query.global
          }
        })
      }

      state.loading = false
      return true
    } catch (err) {
      state.loading = false
      return false
    }
  }

  return { state, detailInit, onDelete, onSave }
}

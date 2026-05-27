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

import {
  defineComponent,
  onMounted,
  onUnmounted,
  PropType,
  toRefs,
  watch,
  ref,
  reactive
} from 'vue'
import { useSyncTask } from './use-sync-task'
import {
  NSpace,
  NCard,
  NDataTable,
  NPagination,
  NInput,
  NSelect,
  NDatePicker,
  NIcon,
  NButton,
  NDropdown
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import Modal from '@/components/modal'
import LogModal from '@/components/log-modal'
import LogViewerModal from './log-viewer-modal'
import ErrorMessageHighlight from './error-message-highlight'
import '@iconify/iconify'
import { useAsyncState } from '@vueuse/core'
import { queryLog } from '@/service/log'
import { LogRes } from '@/service/log/types'
import ColumnSelector from '@/components/column-selector'
import { getRangeShortCuts } from '@/utils/timePickeroption'
import { useRoute, useRouter } from 'vue-router'
import _ from 'lodash'
import {
  getSyncTaskStatusOptions,
  normalizeSyncTaskStatusFilterValue
} from './status-display'

const props = {
  syncTaskType: {
    type: String as PropType<string>,
    default: 'BATCH'
  }
}

const SyncTask = defineComponent({
  name: 'SyncTask',
  props,
  setup(props) {
    let logTimer: number
    const { t } = useI18n()
    const {
      variables,
      getTableData,
      getQueryParams,
      batchBtnListClick,
      creatInstanceButtons,
      createColumns,
      onReset
    } = useSyncTask(props.syncTaskType)
    const route = useRoute()
    const router = useRouter()

    const tableColumn = ref([]) as any
    const requestData = (pageNo = variables.page) => {
      variables.page = pageNo
      getTableData(getQueryParams(pageNo))
    }
    const rangeShortCuts = reactive({
      rangeOption: {}
    })
    rangeShortCuts.rangeOption = getRangeShortCuts(t)

    const onUpdatePageSize = () => {
      variables.page = 1
      requestData()
    }

    const getLogs = (row: any) => {
      const { state } = useAsyncState(
        queryLog({
          taskInstanceId: Number(row.id),
          limit: variables.limit,
          skipLineNum: variables.skipLineNum
        }).then((res: LogRes) => {
          if (res.log) {
            variables.logRef += res.log
          }
          if (res.hasNext) {
            variables.limit += 1000
            variables.skipLineNum += 1000
            clearTimeout(logTimer)
            logTimer = setTimeout(() => {
              getLogs(row)
            }, 2000)
          } else {
            variables.logLoadingRef = false
          }
        }),
        null
      )

      return state
    }

    const refreshLogs = (row: any) => {
      variables.logRef = ''
      variables.limit = 1000
      variables.skipLineNum = 0
      getLogs(row)
    }

    const handleSearch = () => {
      variables.page = 1

      const query = {} as any
      const taskName = variables.taskName?.trim()
      const executeUser = variables.executeUser?.trim()
      const host = variables.host?.trim()

      if (taskName) {
        query.taskName = taskName
      }

      if (executeUser) {
        query.executeUser = executeUser
      }

      if (host) {
        query.host = host
      }

      if (variables.stateType) {
        query.stateType = variables.stateType
      }

      if (variables.datePickerRange) {
        query.startDate = variables.datePickerRange[0]
        query.endDate = variables.datePickerRange[1]
      }

      router.replace({
        query: !_.isEmpty(query)
          ? {
              syncTaskType: props.syncTaskType,
              ...query
            }
          : {
              syncTaskType: props.syncTaskType
            }
      })
      requestData(1)
    }

    const handleReset = () => {
      onReset()
      variables.page = 1
      router.replace({
        query: {
          syncTaskType: props.syncTaskType
        }
      })
      requestData(1)
    }

    const handleKeyup = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        handleSearch()
      }
    }

    const handleRefresh = () => {
      requestData()
    }

    const initSearch = () => {
      const { startDate, endDate } = route.query
      if (startDate && endDate) {
        variables.datePickerRange = [startDate as string, endDate as string]
      }
      variables.taskName = (route.query.taskName as string) || ''
      variables.executeUser = (route.query.executeUser as string) || ''
      variables.host = (route.query.host as string) || ''
      variables.stateType = normalizeSyncTaskStatusFilterValue(
        (route.query.stateType as string) || null
      )
    }

    onMounted(() => {
      initSearch()
      createColumns(variables)
      creatInstanceButtons(variables)
      requestData()
    })

    onUnmounted(() => {
      clearTimeout(logTimer)
    })

    watch(useI18n().locale, () => {
      createColumns(variables)
      creatInstanceButtons(variables)
      rangeShortCuts.rangeOption = getRangeShortCuts(t)
    })

    watch(
      () => variables.showModalRef,
      () => {
        if (variables.showModalRef) {
          getLogs(variables.row)
        } else {
          variables.row = {}
          variables.logRef = ''
          variables.logLoadingRef = true
          variables.skipLineNum = 0
          variables.limit = 1000
          clearTimeout(logTimer)
        }
      }
    )

    const handleChangeColumn = (options: any) => {
      tableColumn.value = options
    }

    return {
      t,
      ...toRefs(variables),
      requestData,
      onUpdatePageSize,
      refreshLogs,
      handleSearch,
      handleReset,
      handleRefresh,
      onReset,
      handleKeyup,
      handleChangeColumn,
      batchBtnListClick,
      tableColumn,
      rangeShortCuts
    }
  },
  render() {
    const { t } = this
    return (
      <NSpace vertical>
        <div style={{ backgroundColor: '#ffffff', height: '74px' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'center',
              height: '100%',
              padding: '12px'
            }}
          >
            <div style={{ flex: '1 1 220px', minWidth: '220px' }}>
              <NInput
                style={{ width: '100%' }}
                v-model={[this.taskName, 'value']}
                placeholder={this.t(
                  'project.synchronization_instance.task_name'
                )}
                onKeyup={this.handleKeyup}
              />
            </div>
            <div style={{ flex: '1 1 180px', minWidth: '180px' }}>
              <NInput
                style={{ width: '100%' }}
                v-model={[this.executeUser, 'value']}
                placeholder={this.t(
                  'project.synchronization_instance.execute_user'
                )}
                onKeyup={this.handleKeyup}
              />
            </div>
            <div style={{ flex: '1 1 220px', minWidth: '220px' }} class="select_options">
              <NSelect
                style={{ width: '100%',height:'32px' }}
                v-model={[this.stateType, 'value']}
                options={getSyncTaskStatusOptions(this.t)}
                placeholder={this.t('project.synchronization_instance.state')}
                clearable
              />
            </div>
            <div style={{ flex: '2 1 360px', minWidth: '360px' }}>
              <NDatePicker
                style={{ width: '100%' }}
                v-model={[this.datePickerRange, 'formattedValue']}
                type='datetimerange'
                format='yyyy-MM-dd HH:mm:ss'
                value-format='yyyy-MM-dd HH:mm:ss'
                start-placeholder={this.t(
                  'project.synchronization_instance.start_time'
                )}
                end-placeholder={this.t(
                  'project.synchronization_instance.end_time'
                )}
                shortcuts={this.rangeShortCuts.rangeOption}
              />
            </div>
            <div
              style={{
                marginLeft: 'auto',
                display: 'flex',
                gap: '8px',
                flexShrink: 0
              }}
            >
              <NSpace justify='end'>
                <NButton  secondary onClick={this.handleReset} class="create-btn1">
                  <span
                style={{ fontSize: '16px' }}
                class="iconify"
                data-icon='system-uicons:reset'
                aria-hidden="true"
              />
            重置
                </NButton>
              
                <NButton  class="create-btn" onClick={this.handleSearch}>
                  <span
                style={{ fontSize: '16px' }}
                class="iconify"
                data-icon='icon-park-outline:find'
                aria-hidden="true"
              />
           <span style={{paddingLeft:'5px'}}>{this.t('project.node.sql_type_query')}</span>
                </NButton>
              </NSpace>
            </div>
          </div>
        </div>
        {/* {t('project.synchronizing_task_instance')} */}
        <div style={{ backgroundColor: '#ffffff', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontWeight: 500, fontSize: '16px' }}>{t('project.synchronizing_task_instance')}</div>
            <ColumnSelector
              tableKey='taskInstance'
              tableColumns={this.columns}
              onChangeOptions={this.handleChangeColumn}
            ></ColumnSelector>
          </div>
          <NSpace vertical>
            <NDataTable
              class='sync-flat-table'
              loading={this.loadingRef}
              columns={this.tableColumn}
              data={this.tableData}
              rowKey={(row) => row.id}
              scrollX={this.tableWidth}
              v-model:checked-row-keys={this.checkedRowKeys}
            />
            <div class="sync-pagination-bar">
              <NSpace justify='center'>
                <NPagination
                  v-model:page={this.page}
                  v-model:page-size={this.pageSize}
                  page-count={this.totalPage}
                  show-size-picker
                  page-sizes={[10, 30, 50]}
                  show-quick-jumper
                  onUpdatePage={this.requestData}
                  onUpdatePageSize={this.onUpdatePageSize}
                />
              </NSpace>
            </div>
          </NSpace>
        </div>
        <LogModal
          showModalRef={this.showModalRef}
          logRef={this.logRef}
          row={this.row}
          logLoadingRef={this.logLoadingRef}
          onConfirmModal={() => (this.showModalRef = false)}
          onRefreshLogs={this.refreshLogs}
        />
        <LogViewerModal
          show={this.showLogViewerModal}
          jobId={this.currentJobId}
          jobName={this.currentJobName}
          onUpdateShow={(v: boolean) => this.showLogViewerModal = v}
        />
        <Modal
          title={t('project.synchronization_instance.error_message')}
          show={this.showErrorMessageModal}
          cancelShow={false}
          confirmText={t('关闭')}
          onConfirm={() => (this.showErrorMessageModal = false)}
          style={{ width: 'min(960px, calc(100vw - 48px))' }}
        >
          <ErrorMessageHighlight params={this.errorMessage} />
        </Modal>
      </NSpace>
    )
  }
})

export { SyncTask }

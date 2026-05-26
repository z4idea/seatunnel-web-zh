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

import { defineComponent, onMounted, toRefs, watch } from 'vue'
import {
  NSpace,
  NCard,
  NButton,
  NInput,
  NIcon,
  NDataTable,
  NPagination
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { SearchOutlined } from '@vicons/antd'
import { useTable } from './use-table'
import { TaskModal } from './task-modal'
import { ScheduleModal } from './schedule-modal'
import { useRoute, useRouter } from 'vue-router'
import _ from 'lodash'
import './index.css'

const SynchronizationDefinition = defineComponent({
  name: 'SynchronizationDefinition',
  setup() {
    const { t } = useI18n()
    const route = useRoute()
    const router = useRouter()
    const { variables, createColumns, getTableData } = useTable()
    const requestData = () => {
      getTableData({
        pageSize: variables.pageSize,
        pageNo: variables.page,
        searchName: variables.searchName
      })
    }

    const onUpdatePageSize = () => {
      variables.page = 1
      requestData()
    }

    const onCancelModal = () => {
      variables.showModalRef = false
    }

    const onConfirmModal = () => {
      variables.showModalRef = false
      requestData()
    }

    const handleModalChange = () => {
      variables.showModalRef = true
    }

    const handleScheduleModalChange = (row: any) => {
      variables.scheduleRow = row
      variables.showScheduleModalRef = true
    }

    const onCancelScheduleModal = () => {
      variables.showScheduleModalRef = false
      variables.scheduleRow = null
    }

    const onSavedScheduleModal = () => {
      requestData()
    }

    const onSearch = () => {
      variables.page = 1

      const query = {} as any
      if (variables.searchName) {
        query.searchName = variables.searchName
      }

      router.replace({
        query: !_.isEmpty(query)
          ? {
              ...query,
              ...route.query
            }
          : {
              ...route.query
            }
      })
      requestData()
    }

    const handleKeyup = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        onSearch()
      }
    }

    const initSearch = () => {
      const { searchName } = route.query
      if (searchName) {
        variables.searchName = searchName as string
      }
    }

    onMounted(() => {
      initSearch()
      createColumns(variables, handleScheduleModalChange)
      requestData()
    })

    watch(useI18n().locale, () => {
      createColumns(variables, handleScheduleModalChange)
    })

    return {
      t,
      ...toRefs(variables),
      onUpdatePageSize,
      requestData,
      onCancelModal,
      onConfirmModal,
      handleModalChange,
      handleScheduleModalChange,
      onCancelScheduleModal,
      onSavedScheduleModal,
      onSearch,
      handleKeyup
    }
  },
 render() {
    return (
      <div class="sync-definition-wrapper">
        {/* 顶部操作栏 - 无卡片、平铺 */}
        <div class="sync-top-bar">
          <NButton class="create-btn" onClick={this.handleModalChange}>
            <NIcon size={14} style={{ marginRight: 6 }}>
              <span
                style={{ fontSize: '16px' }}
                class="iconify"
                data-icon="icon-park-outline:add"
                aria-hidden="true"
              />
            </NIcon>
            <span style={{paddingLeft:'5px'}}>{this.t('project.synchronization_definition.create_synchronization_task')}</span>
          </NButton>
          <NSpace>
            <NInput
              clearable
              size="small"
              style={{ width: 240,height:36+'px' }}
              v-model={[this.searchName, 'value']}
              placeholder={this.t('project.synchronization_definition.task_name')}
              onKeyup={this.handleKeyup}
            />
            <NButton class="create-btn"  onClick={this.onSearch}>
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

        {/* 列表容器 - 纯扁平化 */}
        <div class="sync-list-container">
          {/* 表格 - 完全匹配目标样式 */}
            <NDataTable
            class="sync-flat-table"
            loading={this.loadingRef}
            columns={this.columns}
            data={this.tableData}
            scrollX={this.tableWidth}
            bordered={false} // 去掉表格边框
            size="medium"
            align="center"
            pagination={false} // 关闭内置分页，自定义
          />

          {/* 分页栏 - 靠右、分隔线 */}
          <div class="sync-pagination-bar">
            <NPagination
              v-model:page={this.page}
              v-model:page-size={this.pageSize}
              page-count={this.totalPage}
              show-size-picker
              page-sizes={[10, 30, 50]}
              show-quick-jumper
              onUpdatePage={this.requestData}
              onUpdatePageSize={this.onUpdatePageSize}
              size="small"
            />
          </div>
        </div>

        {/* 模态框保持不变 */}
        <TaskModal
          showModalRef={this.showModalRef}
          onCancelModal={this.onCancelModal}
          onConfirmModal={this.onConfirmModal}
        />
        <ScheduleModal
          show={this.showScheduleModalRef}
          row={this.scheduleRow}
          onCancel={this.onCancelScheduleModal}
          onSaved={this.onSavedScheduleModal}
        />
      </div>
    )
  }
})

export default SynchronizationDefinition

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

import { computed, defineComponent, PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { NDescriptions, NDescriptionsItem } from 'naive-ui'
import Modal from '@/components/modal'

const props = {
  show: {
    type: Boolean as PropType<boolean>,
    default: false
  },
  row: {
    type: Object as PropType<Record<string, any> | null>,
    default: null
  }
}

const TaskDetailModal = defineComponent({
  name: 'TaskDetailModal',
  props,
  emits: ['close'],
  setup(props, ctx) {
    const { t } = useI18n()

    const fieldLabels: Record<string, string> = {
      id: t('common.id'),
      name: t('project.synchronization_definition.synchronization_task_name'),
      description: t('project.synchronization_definition.task_describe'),
      sourceDatabaseTable: t(
        'project.synchronization_definition.source_database_table'
      ),
      jobType: t('project.synchronization_definition.business_model'),
      createUserName: t('project.synchronization_definition.create_user'),
      createTime: t('project.synchronization_definition.create_time'),
      updateUserName: t('project.synchronization_definition.update_user'),
      updateTime: t('project.synchronization_definition.update_time'),
      projectCode: t('common.project_code'),
      projectName: t('common.project_name'),
      scheduleEnabled: t('project.synchronization_definition.schedule_status'),
      scheduleNextTriggerTime: t(
        'project.synchronization_definition.schedule_next_trigger'
      ),
      scheduleLastStatus: t(
        'project.synchronization_definition.schedule_last_status'
      )
    }

    const orderedKeys = [
      'id',
      'name',
      'description',
      'sourceDatabaseTable',
      'jobType',
      'createUserName',
      'createTime',
      'updateUserName',
      'updateTime',
      'projectCode',
      'projectName',
      'scheduleEnabled',
      'scheduleNextTriggerTime',
      'scheduleLastStatus'
    ]

    const formatValue = (key: string, value: any) => {
      if (value === null || value === undefined || value === '') {
        return '-'
      }

      if (key === 'jobType') {
        return t(
          `project.synchronization_definition.${
            value === 'DATA_REPLICA' ? 'whole_library_sync' : 'data_integration'
          }`
        )
      }

      if (key === 'scheduleEnabled') {
        if (value === true) {
          return t('project.synchronization_definition.schedule_enabled')
        }
        if (value === false) {
          return t('project.synchronization_definition.schedule_disabled')
        }
      }

      if (typeof value === 'object') {
        return JSON.stringify(value)
      }

      return String(value)
    }

    const detailItems = computed(() => {
      const row = props.row || {}
      const extraKeys = Object.keys(row).filter(
        (key) => !orderedKeys.includes(key)
      )

      return [...orderedKeys, ...extraKeys]
        .filter((key, index, array) => key in row && array.indexOf(key) === index)
        .map((key) => ({
          key,
          label: fieldLabels[key] || key,
          value: formatValue(key, row[key])
        }))
    })

    const close = () => {
      ctx.emit('close')
    }

    return {
      t,
      close,
      detailItems
    }
  },
  render() {
    return (
      <Modal
        title={this.t('project.synchronization_definition.task_detail')}
        show={this.show}
        cancelShow={false}
        confirmText={this.t('project.synchronization_definition.close')}
        onConfirm={this.close}
        onCancel={this.close}
      >
        <NDescriptions bordered labelPlacement='left' column={1}>
          {this.detailItems.map((item) => (
            <NDescriptionsItem key={item.key} label={item.label}>
              {item.value}
            </NDescriptionsItem>
          ))}
        </NDescriptions>
      </Modal>
    )
  }
})

export { TaskDetailModal }

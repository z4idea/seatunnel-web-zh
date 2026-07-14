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
// @author: zhjj

import { h } from 'vue'
import { useI18n } from 'vue-i18n'
import { NPopover, NButton, NSpace, NPopconfirm, NEllipsis } from 'naive-ui'
import JsonHighlight from '../components/json-highlight'
import { getTableColumn } from '@/common/table'
import '@iconify/iconify'

export function useColumns(onCallback: Function) {
  const { t } = useI18n()
  const getColumns = () => {
    return [
      ...getTableColumn([{ key: 'id', title: t('datasource.id') }]),
      {
        title: t('datasource.datasource_name'),
        key: 'datasourceName',
        className: 'col-left',
        minWidth: 180,
        render: (row: any) => {
          return h(
            'div',
            { style: { maxWidth: '260px' } },
            [
              h(
                NEllipsis,
                { lineClamp: 2 },
                { default: () => row.datasourceName || '-' }
              )
            ]
          )
        }
      },
      {
        title: t('datasource.datasource_user_name'),
        key: 'createUserName',
        className: 'col-left'
      },
      {
        title: t('datasource.datasource_type'),
        key: 'pluginName',
        width: 180
      },
      {
        title: t('datasource.datasource_parameter'),
        key: 'parameter',
        width: 180,
        render: (row: any) => {
          return row.datasourceConfig
            ? h(
                NPopover,
                { trigger: 'click' },
                {
                  trigger: () =>
                    h(
                      NButton,
                      { text: true, type: 'primary' },
                      {
                        default: () => t('datasource.click_to_view')
                      }
                    ),
                  default: () =>
                    h(JsonHighlight, {
                      params: JSON.stringify(row.datasourceConfig) as string
                    })
                }
              )
            : '--'
        }
      },
      {
        title: t('datasource.description'),
        key: 'description',
        className: 'col-left',
        render: (row: any) =>
          h(
            'div',
            { style: { maxWidth: '200px' } },
            [
              h(
                NEllipsis,
                { lineClamp: 2 },
                { default: () => row.description || '-' }
              )
            ]
          )
      },
      {
        title: t('datasource.create_time'),
        key: 'createTime',
        render: (row: any) => (row.createTime || '').substring(0, 16) || '-'
      },
      {
        title: t('datasource.update_time'),
        key: 'updateTime',
        render: (row: any) => (row.updateTime || '').substring(0, 16) || '-'
      },
      {
        title: t('datasource.operation'),
        key: 'operation',
        fixed: 'right',
        width: 150,
        render: (row: any) => {
          const operationNodes = []

          if (row.editable !== false) {
            operationNodes.push(
              h(
                'a',
                {
                  class: 'sync-operation-btn',
                  onClick: () => void onCallback(row.id, 'edit'),
                  style: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#7598c4'
                  }
                },
                [
                  h('i', {
                    class: 'iconify',
                    'data-icon': 'line-md:edit',
                    'data-inline': 'false',
                    style: { fontSize: '14px' }
                  }),
                  t('datasource.edit')
                ]
              )
            )
          }

          if (row.deletable !== false) {
            operationNodes.push(
              h(
                NPopconfirm,
                {
                  negativeText: t('datasource.cancel'),
                  positiveText: t('datasource.confirm'),
                  onPositiveClick: () => void onCallback(row.id, 'delete')
                },
                {
                  trigger: () =>
                    h(
                      'a',
                      {
                        class: 'sync-operation-btn',
                        style: {
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }
                      },
                      [
                        h('i', {
                          class: 'iconify',
                          'data-icon': 'material-symbols:delete-outline',
                          'data-inline': 'false',
                          style: { fontSize: '14px' }
                        }),
                        t('datasource.delete')
                      ]
                    ),
                  default: () => t('datasource.delete_confirm')
                }
              )
            )
          }

          return operationNodes.length
            ? h(NSpace, { size: 'small' }, operationNodes)
            : '-'
        }
      }
    ]
  }

  return {
    getColumns
  }
}

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

import { defineComponent, h, nextTick, PropType, ref, watch } from 'vue'
import {
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NSpace,
  NButton,
  NDataTable,
  NInputNumber,
  NSwitch,
  NAlert,
  NRadioGroup,
  NRadio,
  NCheckboxGroup,
  NCheckbox,
  NSpin,
  NTransfer,
  NPopover
} from 'naive-ui'
import { DynamicFormItem } from '@/components/dynamic-form/dynamic-form-item'
import JsonHighlight from '@/views/datasource/components/json-highlight'
import { KINDS } from './config'
import {
  useConfigurationForm,
  getSceneModeOptions
} from './use-configuration-form'
import { useI18n } from 'vue-i18n'
import type { NodeType, TableOption } from './types'
import { debounce } from 'lodash'

const ConfigurationForm = defineComponent({
  name: 'ConfigurationForm',
  props: {
    // eslint-disable-next-line vue/require-default-prop
    nodeType: {
      type: String as PropType<string>
    },
    // eslint-disable-next-line vue/require-default-prop
    nodeId: {
      type: String as PropType<string>
    },
    // eslint-disable-next-line vue/require-default-prop
    transformType: {
      type: String as PropType<string>
    },
    sourceKind: {
      type: String as PropType<string>,
      default: ''
    }
  },
  emits: ['tableNameChange'],
  setup(props, { expose, emit }) {
    const {
      state,
      dagStore,
      getDatasourceOptions,
      getDatabaseOptions,
      getTableOptions,
      clearIncrementalValues,
      refreshIncrementalColumnOptions,
      updateFormValues,
      previewLocalFileData,
      previewHttpSourceData,
      isLocalFileSource,
      isHttpSource
    } = useConfigurationForm(
      props.nodeType as NodeType,
      props.transformType as string,
      props.sourceKind
    )
    const { t } = useI18n()
    const formRef = ref()
    const transfer = ref()
    const sinkTableMode = ref<'existing' | 'custom'>('existing')
    const sinkCustomTableName = ref('')
    const localizedKinds = KINDS.map((kind) => ({
      ...kind,
      label: t(`project.synchronization_definition.${kind.labelKey}`)
    }))
    const localFileFormatOptions = [
      { label: 'csv', value: 'csv' },
      { label: 'json', value: 'json' }
    ]
    const schemaTypeOptions = [
      'STRING',
      'BOOLEAN',
      'INT',
      'BIGINT',
      'DOUBLE',
      'DECIMAL',
      'DATE',
      'TIMESTAMP'
    ].map((value) => ({ label: value, value }))

    const isSpecialSource = () => isLocalFileSource() || isHttpSource()

    const addLocalFileField = () => {
      state.model.localFileSchemaFields.push({
        name: `column_${state.model.localFileSchemaFields.length + 1}`,
        type: 'STRING',
        outputDataType: 'STRING',
        nullable: true,
        primaryKey: false,
        defaultValue: '',
        comment: '',
        unSupport: false
      })
    }

    const addHttpField = () => {
      state.model.httpSchemaCustomized = true
      state.model.httpSchemaFields.push({
        name: `column_${state.model.httpSchemaFields.length + 1}`,
        type: 'STRING',
        outputDataType: 'STRING',
        nullable: true,
        primaryKey: false,
        defaultValue: '',
        comment: '',
        unSupport: false
      })
    }

    const localFileSchemaColumns = [
      {
        title: '#',
        key: 'index',
        width: 54,
        render: (_row: any, index: number) => index + 1
      },
      {
        title: t('project.synchronization_definition.field_name'),
        key: 'name',
        render: (row: any) =>
          h(NInput, {
            value: row.name,
            onUpdateValue: (value: string) => {
              row.name = value
            }
          })
      },
      {
        title: t('project.synchronization_definition.field_type'),
        key: 'type',
        render: (row: any) =>
          h(NSelect, {
            value: row.outputDataType || row.type,
            options: schemaTypeOptions,
            onUpdateValue: (value: string) => {
              row.type = value
              row.outputDataType = value
            }
          })
      },
      {
        title: t('project.synchronization_definition.operation'),
        key: 'operation',
        width: 92,
        render: (_row: any, index: number) =>
          h(
            NButton,
            {
              text: true,
              type: 'error',
              onClick: () => {
                state.model.localFileSchemaFields.splice(index, 1)
              }
            },
            () => t('project.synchronization_definition.delete')
          )
      }
    ]

    const getLocalFilePreviewColumns = () =>
      state.model.localFileSchemaFields.map((field: any) => ({
        title: field.name,
        key: field.name,
        ellipsis: {
          tooltip: true
        }
      }))

    const httpSchemaColumns = [
      {
        title: '#',
        key: 'index',
        width: 54,
        render: (_row: any, index: number) => index + 1
      },
      {
        title: t('project.synchronization_definition.field_name'),
        key: 'name',
        render: (row: any) =>
          h(NInput, {
            value: row.name,
            onUpdateValue: (value: string) => {
              state.model.httpSchemaCustomized = true
              row.name = value
            }
          })
      },
      {
        title: t('project.synchronization_definition.field_type'),
        key: 'type',
        render: (row: any) =>
          h(NSelect, {
            value: row.outputDataType || row.type,
            options: schemaTypeOptions,
            onUpdateValue: (value: string) => {
              state.model.httpSchemaCustomized = true
              row.type = value
              row.outputDataType = value
            }
          })
      },
      {
        title: t('project.synchronization_definition.operation'),
        key: 'operation',
        width: 92,
        render: (_row: any, index: number) =>
          h(
            NButton,
            {
              text: true,
              type: 'error',
              onClick: () => {
                state.model.httpSchemaCustomized = true
                state.model.httpSchemaFields.splice(index, 1)
              }
            },
            () => t('project.synchronization_definition.delete')
          )
      }
    ]

    const tryParseJsonLikeText = (value: any) => {
      if (typeof value !== 'string') return null
      const trimmed = value.trim()
      if (
        !(trimmed.startsWith('{') && trimmed.endsWith('}')) &&
        !(trimmed.startsWith('[') && trimmed.endsWith(']'))
      ) {
        return null
      }
      try {
        return JSON.parse(trimmed)
      } catch (error) {
        return null
      }
    }

    const formatHttpPreviewValue = (value: any) => {
      if (value === null || value === undefined || value === '') return '-'
      if (typeof value === 'boolean') return value ? 'true' : 'false'
      if (typeof value === 'number') return String(value)

      const parsed = tryParseJsonLikeText(value)
      if (Array.isArray(parsed)) {
        return t('project.synchronization_definition.http_preview_json_array', {
          count: parsed.length
        })
      }
      if (parsed && typeof parsed === 'object') {
        return t(
          'project.synchronization_definition.http_preview_json_object',
          { count: Object.keys(parsed).length }
        )
      }

      return String(value)
    }

    const renderHttpPreviewPopoverContent = (value: any) => {
      const parsed = tryParseJsonLikeText(value)
      if (parsed && !Array.isArray(parsed)) {
        return h(JsonHighlight, {
          params: JSON.stringify(parsed)
        })
      }
      return h(
        'pre',
        {
          style: {
            maxWidth: '420px',
            maxHeight: '320px',
            margin: '0',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: '12px',
            lineHeight: '1.5'
          }
        },
        parsed ? JSON.stringify(parsed, null, 2) : formatSummaryValue(value)
      )
    }

    const renderHttpPreviewCell = (value: any) =>
      h(
        NPopover,
        {
          trigger: 'hover',
          placement: 'top-start',
          width: 420
        },
        {
          trigger: () =>
            h(
              'div',
              {
                style: {
                  maxWidth: '160px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  color: '#1f2937'
                }
              },
              formatHttpPreviewValue(value)
            ),
          default: () => renderHttpPreviewPopoverContent(value)
        }
      )

    const renderHttpColumnTitle = (fullKey: string, label: string) =>
      h(
        NPopover,
        {
          trigger: 'hover',
          placement: 'top'
        },
        {
          trigger: () =>
            h(
              'div',
              {
                style: {
                  fontWeight: 500,
                  whiteSpace: 'nowrap'
                }
              },
              label
            ),
          default: () =>
            h(
              'div',
              {
                style: {
                  maxWidth: '320px',
                  wordBreak: 'break-all',
                  fontSize: '12px'
                }
              },
              `${t(
                'project.synchronization_definition.http_preview_field_path'
              )}: ${fullKey}`
            )
        }
      )

    const buildHttpPreviewColumnTree = (
      columns: Array<{ key: string; path: string }>
    ) => {
      const root: any[] = []

      columns.forEach(({ key, path }) => {
        const normalizedPath = String(path || key || '')
        const segments = normalizedPath.split('.').filter(Boolean)
        if (!segments.length) return

        let currentLevel = root
        segments.forEach((segment, index) => {
          let node = currentLevel.find((item: any) => item.label === segment)
          if (!node) {
            node = {
              label: segment,
              fullKey: null,
              children: [] as any[]
            }
            currentLevel.push(node)
          }

          if (index === segments.length - 1) {
            node.fullKey = key
            node.originalPath = normalizedPath
          }
          currentLevel = node.children
        })
      })

      return root
    }

    const buildHttpPreviewColumns = (nodes: any[]): any[] =>
      nodes.map((node) => {
        if (node.children?.length) {
          return {
            title: node.label,
            key: `group-${node.label}-${node.fullKey || ''}`,
            children: buildHttpPreviewColumns(node.children)
          }
        }

        const columnKey = node.fullKey || node.label
        return {
          title: renderHttpColumnTitle(
            node.originalPath || columnKey,
            node.label
          ),
          key: columnKey,
          width: 160,
          minWidth: 140,
          ellipsis: false,
          render: (row: any) => renderHttpPreviewCell(row[columnKey])
        }
      })

    const getHttpPreviewColumns = () => {
      const schemaFields = state.model.httpSchemaFields || []
      const columns = schemaFields.length
        ? schemaFields.map((field: any) => ({
            key: field.name,
            path: field.comment || field.name
          }))
        : Object.keys(state.model.httpPreviewRows[0] || {}).map((key) => ({
            key,
            path: key
          }))
      if (!columns.length) return []
      return buildHttpPreviewColumns(buildHttpPreviewColumnTree(columns))
    }

    const getHttpPreviewScrollX = () => {
      const schemaFields = state.model.httpSchemaFields || []
      const keys = schemaFields.length
        ? schemaFields.map((field: any) => field.name)
        : Object.keys(state.model.httpPreviewRows[0] || {})
      return Math.max(keys.length * 160, 900)
    }

    const formatSummaryValue = (value: any) => {
      if (value === null || value === undefined || value === '') return '-'
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2)
      }
      return String(value)
    }

    const onTableChange = async (tableName: any) => {
      state.model.tableName = tableName
      if (props.nodeType === 'sink' && state.model.database) {
        await getTableOptions(state.model.database, '')
      }
      emit('tableNameChange', state.model)
    }

    const onSinkCustomTableNameChange = (value: string) => {
      sinkCustomTableName.value = value
      state.model.tableName = value
      emit('tableNameChange', state.model)
    }

    const onSinkTableModeChange = (mode: 'existing' | 'custom') => {
      sinkTableMode.value = mode
      if (mode === 'custom') {
        const currentTableName = String(state.model.tableName || '').trim()
        sinkCustomTableName.value = currentTableName
        state.model.tableName = currentTableName || sinkCustomTableName.value
        emit('tableNameChange', state.model)
        return
      }

      const currentTableName = String(state.model.tableName || '').trim()
      const matchedOption = state.tableOptions.find(
        (option: TableOption) => option.value === currentTableName
      )
      if (matchedOption) {
        state.model.tableName = matchedOption.value
        emit('tableNameChange', state.model)
        return
      }

      state.model.tableName = null
      emit('tableNameChange', state.model)
    }

    const onLogicalTableNameChange = (value: string) => {
      state.model.tableName = value
      emit('tableNameChange', state.model)
    }

    const prevQueryTableName = ref('')
    const onTableSearch = debounce(async (tableName: any) => {
      if (state.model.database && prevQueryTableName.value !== tableName) {
        getTableOptions(state.model.database, tableName)
        prevQueryTableName.value = tableName
      }
    }, 1000)

    watch(
      [() => state.model.tableName, () => state.tableOptions],
      ([tableName, tableOptions]) => {
        if (props.nodeType !== 'sink') return
        const normalizedTableName = String(tableName || '').trim()
        if (!normalizedTableName) {
          if (sinkTableMode.value === 'custom') {
            sinkCustomTableName.value = ''
          }
          return
        }

        const matchesExistingOption = tableOptions.some(
          (option: TableOption) => option.value === normalizedTableName
        )
        if (matchesExistingOption) {
          if (sinkTableMode.value !== 'custom') {
            sinkTableMode.value = 'existing'
          }
          return
        }

        sinkTableMode.value = 'custom'
        sinkCustomTableName.value = normalizedTableName
      },
      { deep: true, immediate: true }
    )

    const onDatabaseChange = () => {
      clearIncrementalValues()
      nextTick(() => {
        if (state.model.database) {
          const size =
            state.model.sceneMode === 'MULTIPLE_TABLE' ? 9999999 : 100
          getTableOptions(state.model.database as any, '', size)
        }
      })
    }

    // watchEffect(() => {
    //   // Track the src input of the transfer and refresh the table name list when the input value change
    //   let query = transfer?.value?.srcPattern
    //   onTableSearch(query)
    // })

    expose({
      validate: async () => {
        try {
          await formRef.value.validate()
          if (isLocalFileSource()) {
            const fields = state.model.localFileSchemaFields || []
            if (
              fields.length === 0 ||
              fields.some((field: any) => !field.name || !field.type)
            ) {
              window.$message.warning(
                t(
                  'project.synchronization_definition.local_file_schema_required'
                )
              )
              return false
            }
          }
          if (isHttpSource()) {
            const fields = state.model.httpSchemaFields || []
            if (
              fields.length === 0 ||
              fields.some((field: any) => !field.name || !field.type)
            ) {
              window.$message.warning(
                t('project.synchronization_definition.http_schema_required')
              )
              return false
            }
          }
          return true
        } catch (err) {
          return false
        }
      },
      getValues: () => state.model,
      setValues: updateFormValues,
      getIncrementalStateContext: () => ({
        loading:
          state.loading ||
          state.formLoading ||
          state.datasourceLoading ||
          state.databaseLoading ||
          state.tableLoading ||
          state.incrementalColumnLoading,
        values: state.model,
        fieldNames: state.formFieldNames
      })
    })

    return () => (
      <NSpin show={state.loading}>
        <NForm ref={formRef} model={state.model} rules={state.rules}>
          <NFormItem
            label={t('project.synchronization_definition.node_name')}
            path='name'
          >
            <NInput
              clearable
              v-model={[state.model.name, 'value']}
              placeholder={t(
                'project.synchronization_definition.node_name_placeholder'
              )}
            />
          </NFormItem>

          {props.nodeType === 'source' && (
            <NFormItem
              label={t('project.synchronization_definition.scene_mode')}
              path='sceneMode'
            >
              <NSelect
                filterable
                disabled={isSpecialSource()}
                options={getSceneModeOptions(dagStore.getDagInfo.jobType, t)}
                v-model={[state.model.sceneMode, 'value']}
                onUpdateValue={(v) => {
                  if (v !== state.model.sceneMode) {
                    getDatasourceOptions(v)
                    state.model.datasourceInstanceId = null
                    state.model.database = null
                    state.model.tableName = null
                    clearIncrementalValues()
                    state.formStructure = []
                    state.formFieldNames = []
                    state.databaseOptions = []
                    state.tableOptions = []
                  }
                }}
              />
            </NFormItem>
          )}

          {props.nodeType !== 'transform' && (
            <NFormItem
              label={t('project.synchronization_definition.source_name')}
              path='datasourceInstanceId'
            >
              <NSelect
                filterable
                loading={state.datasourceLoading}
                options={state.datasourceOptions}
                v-model={[state.model.datasourceInstanceId, 'value']}
                onUpdateValue={(v, option) => {
                  if (v !== state.model.datasourceInstanceId) {
                    state.model.database = null
                    state.model.tableName = null
                    clearIncrementalValues()
                    state.formFieldNames = []
                    state.tableOptions = []
                    getDatabaseOptions(v, option)
                  }
                }}
              />
            </NFormItem>
          )}

          {isLocalFileSource() && (
            <>
              <NFormItem
                label={t('project.synchronization_definition.local_file_path')}
              >
                <NInput value={state.model.localFilePath} readonly />
              </NFormItem>
              <NFormItem
                label={t(
                  'project.synchronization_definition.local_file_format'
                )}
              >
                <NSelect
                  disabled
                  options={localFileFormatOptions}
                  v-model={[state.model.localFileFormat, 'value']}
                />
              </NFormItem>
              <NFormItem label={t('common.encoding')}>
                <NInput
                  v-model={[state.model.encoding, 'value']}
                  placeholder='UTF-8'
                />
              </NFormItem>
              {state.model.localFileFormat === 'csv' && (
                <>
                  <NFormItem
                    label={t(
                      'project.synchronization_definition.csv_use_header_line'
                    )}
                  >
                    <NSwitch
                      v-model={[state.model.csv_use_header_line, 'value']}
                    />
                  </NFormItem>
                  <NFormItem
                    label={t(
                      'project.synchronization_definition.skip_header_row_number'
                    )}
                  >
                    <NInputNumber
                      min={0}
                      v-model={[state.model.skip_header_row_number, 'value']}
                    />
                  </NFormItem>
                </>
              )}
              <NFormItem
                label={t(
                  'project.synchronization_definition.local_file_schema'
                )}
              >
                <NSpace vertical style={{ width: '100%' }}>
                  <NSpace>
                    <NButton
                      type='primary'
                      secondary
                      loading={state.localFilePreviewLoading}
                      onClick={previewLocalFileData}
                    >
                      {t(
                        'project.synchronization_definition.local_file_preview'
                      )}
                    </NButton>
                    <NButton onClick={addLocalFileField}>
                      {t(
                        'project.synchronization_definition.local_file_add_field'
                      )}
                    </NButton>
                  </NSpace>
                  {state.model.localFileWarnings.map((warning: string) => (
                    <NAlert type='warning' showIcon>
                      {warning}
                    </NAlert>
                  ))}
                  <NDataTable
                    size='small'
                    columns={localFileSchemaColumns}
                    data={state.model.localFileSchemaFields}
                    rowKey={(row) => row.name}
                  />
                </NSpace>
              </NFormItem>
              <NFormItem
                label={t(
                  'project.synchronization_definition.local_file_preview'
                )}
              >
                <NDataTable
                  size='small'
                  columns={getLocalFilePreviewColumns()}
                  data={state.model.localFilePreviewRows}
                  maxHeight={240}
                  scrollX={900}
                />
              </NFormItem>
            </>
          )}

          {isHttpSource() && (
            <>
              <NFormItem
                label={t(
                  'project.synchronization_definition.http_request_summary'
                )}
              >
                <NSpace vertical style={{ width: '100%' }}>
                  <NFormItem
                    label={t(
                      'project.synchronization_definition.http_summary_url'
                    )}
                  >
                    <NInput
                      value={formatSummaryValue(
                        state.model.httpDatasourceConfig.url
                      )}
                      readonly
                      type='textarea'
                      rows={2}
                    />
                  </NFormItem>
                  <NFormItem
                    label={t(
                      'project.synchronization_definition.http_summary_method'
                    )}
                  >
                    <NInput
                      value={formatSummaryValue(
                        state.model.httpDatasourceConfig.method
                      )}
                      readonly
                    />
                  </NFormItem>
                  <NFormItem
                    label={t(
                      'project.synchronization_definition.http_summary_headers'
                    )}
                  >
                    <NInput
                      value={formatSummaryValue(
                        state.model.httpDatasourceConfig.headers
                      )}
                      readonly
                      type='textarea'
                      rows={3}
                    />
                  </NFormItem>
                  <NFormItem
                    label={t(
                      'project.synchronization_definition.http_summary_params'
                    )}
                  >
                    <NInput
                      value={formatSummaryValue(
                        state.model.httpDatasourceConfig.params
                      )}
                      readonly
                      type='textarea'
                      rows={3}
                    />
                  </NFormItem>
                  <NFormItem
                    label={t(
                      'project.synchronization_definition.http_summary_content_type'
                    )}
                  >
                    <NInput
                      value={formatSummaryValue(
                        state.model.httpDatasourceConfig.content_type
                      )}
                      readonly
                    />
                  </NFormItem>
                  <NFormItem
                    label={t(
                      'project.synchronization_definition.http_summary_body'
                    )}
                  >
                    <NInput
                      value={formatSummaryValue(
                        state.model.httpDatasourceConfig.body
                      )}
                      readonly
                      type='textarea'
                      rows={4}
                    />
                  </NFormItem>
                </NSpace>
              </NFormItem>

              <NFormItem
                label={t('project.synchronization_definition.table_name')}
                path='tableName'
              >
                <NInput
                  clearable
                  v-model={[state.model.tableName, 'value']}
                  placeholder={t(
                    'project.synchronization_definition.http_table_name_placeholder'
                  )}
                  onUpdateValue={onLogicalTableNameChange}
                />
              </NFormItem>

              <NFormItem
                label={t('project.synchronization_definition.http_schema')}
              >
                <NSpace vertical style={{ width: '100%' }}>
                  <NSpace>
                    <NButton
                      type='primary'
                      secondary
                      loading={state.httpPreviewLoading}
                      onClick={previewHttpSourceData}
                    >
                      {t('project.synchronization_definition.http_preview')}
                    </NButton>
                    <NButton onClick={addHttpField}>
                      {t('project.synchronization_definition.http_add_field')}
                    </NButton>
                  </NSpace>
                  {state.model.httpWarnings.map((warning: string) => (
                    <NAlert type='warning' showIcon>
                      {warning}
                    </NAlert>
                  ))}
                  <NDataTable
                    size='small'
                    columns={httpSchemaColumns}
                    data={state.model.httpSchemaFields}
                    rowKey={(row) => row.name}
                  />
                </NSpace>
              </NFormItem>

              <NFormItem
                label={t('project.synchronization_definition.http_preview')}
              >
                <NSpace vertical style={{ width: '100%' }}>
                  <NAlert type='info' showIcon={false}>
                    {t(
                      'project.synchronization_definition.http_preview_grouped_hint'
                    )}
                  </NAlert>
                  <NDataTable
                    size='small'
                    columns={getHttpPreviewColumns()}
                    data={state.model.httpPreviewRows}
                    maxHeight={280}
                    scrollX={getHttpPreviewScrollX()}
                  />
                </NSpace>
              </NFormItem>
            </>
          )}

          {props.nodeType !== 'transform' && !isSpecialSource() && (
            <NFormItem
              label={t('project.synchronization_definition.database')}
              path='database'
            >
              <NSelect
                filterable
                loading={state.databaseLoading}
                multiple={state.model.sceneMode === 'SPLIT_TABLE'}
                options={state.databaseOptions}
                v-model={[state.model.database, 'value']}
                onUpdateValue={(v) => {
                  if (v !== state.model.database) {
                    onDatabaseChange()
                    state.model.tableName = null
                    sinkCustomTableName.value = ''
                    sinkTableMode.value = 'existing'
                    clearIncrementalValues()
                  }
                }}
              />
            </NFormItem>
          )}

          {dagStore.getDagInfo.jobType === 'DATA_INTEGRATION' &&
            (props.nodeType === 'sink' || props.nodeType === 'source') &&
            !isSpecialSource() && (
              <NFormItem
                label={t('project.synchronization_definition.table_name')}
                path='tableName'
              >
                {props.nodeType === 'sink' ? (
                  <NSpace vertical style={{ width: '100%' }}>
                    <NRadioGroup
                      value={sinkTableMode.value}
                      onUpdateValue={onSinkTableModeChange}
                    >
                      <NSpace>
                        <NRadio value='existing'>
                          {t(
                            'project.synchronization_definition.table_name_mode_select'
                          )}
                        </NRadio>
                        <NRadio value='custom'>
                          {t(
                            'project.synchronization_definition.table_name_mode_custom'
                          )}
                        </NRadio>
                      </NSpace>
                    </NRadioGroup>
                    {sinkTableMode.value === 'existing' ? (
                      <NSelect
                        filterable
                        loading={state.tableLoading}
                        options={state.tableOptions}
                        value={state.model.tableName}
                        onUpdateValue={onTableChange}
                        onSearch={onTableSearch}
                        remote
                        virtualScroll
                        clearable
                        showArrow
                        placeholder={t(
                          'project.synchronization_definition.select_table_name_placeholder'
                        )}
                      />
                    ) : (
                      <NInput
                        clearable
                        value={sinkCustomTableName.value}
                        onUpdateValue={onSinkCustomTableNameChange}
                        placeholder={t(
                          'project.synchronization_definition.custom_table_name_placeholder'
                        )}
                      />
                    )}
                  </NSpace>
                ) : (
                  <NSelect
                    filterable
                    loading={state.tableLoading}
                    options={state.tableOptions}
                    v-model={[state.model.tableName, 'value']}
                    onUpdateValue={onTableChange}
                    onSearch={onTableSearch}
                    remote
                    virtualScroll
                    clearable
                    showArrow
                    placeholder={t(
                      'project.synchronization_definition.target_name_tips'
                    )}
                  />
                )}
              </NFormItem>
            )}

          {state.model.sceneMode === 'MULTIPLE_TABLE' && !isSpecialSource() && (
            <NFormItem
              label={t('project.synchronization_definition.table_name')}
              path='tableName'
            >
              <NTransfer
                style={{ width: '100%' }}
                ref={transfer}
                filterable
                sourceTitle={t('project.synchronization_definition.table_sync')}
                targetTitle={t(
                  'project.synchronization_definition.selected_table'
                )}
                options={state.tableOptions}
                v-model={[state.model.tableName, 'value']}
                onUpdateValue={onTableChange}
                virtualScroll
              />
            </NFormItem>
          )}

          {props.transformType === 'FilterRowKind' && (
            <>
              <NFormItem
                label={t('project.synchronization_definition.kind')}
                path='kind'
                showFeedback={false}
                showRequireMark
              >
                <NRadioGroup
                  v-model={[state.model.kind, 'value']}
                  name='model.kind'
                >
                  <NSpace>
                    <NRadio value={0}>
                      {t('project.synchronization_definition.include_kind')}
                    </NRadio>
                    <NRadio value={1}>
                      {t('project.synchronization_definition.exclude_kind')}
                    </NRadio>
                  </NSpace>
                </NRadioGroup>
              </NFormItem>
              <NFormItem showLabel={false} path='kinds'>
                <NCheckboxGroup v-model={[state.model.kinds, 'value']}>
                  <NSpace>
                    {localizedKinds.map((kind) => (
                      <NCheckbox value={kind.value} label={kind.label} />
                    ))}
                  </NSpace>
                </NCheckboxGroup>
              </NFormItem>
            </>
          )}

          {props.transformType === 'Sql' && (
            <NFormItem
              label={t('project.synchronization_definition.sql_content_label')}
              path='query'
            >
              <NInput
                v-model={[state.model.query, 'value']}
                type='textarea'
                clearable
                placeholder={t(
                  'project.synchronization_definition.sql_content_label_placeholder'
                )}
              />
            </NFormItem>
          )}

          {state.formStructure.length > 0 && !isLocalFileSource() && (
            <DynamicFormItem
              model={state.model}
              formStructure={state.formStructure}
              name={state.formName}
              locales={state.formLocales}
            />
          )}
        </NForm>
      </NSpin>
    )
  }
})

export default ConfigurationForm

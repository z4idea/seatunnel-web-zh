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

import { defineComponent, h, nextTick, PropType, ref } from 'vue'
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
  NTransfer
} from 'naive-ui'
import { DynamicFormItem } from '@/components/dynamic-form/dynamic-form-item'
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
      isLocalFileSource
    } = useConfigurationForm(
      props.nodeType as NodeType,
      props.transformType as string,
      props.sourceKind
    )
    const { t } = useI18n()
    const formRef = ref()
    const transfer = ref()
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

    const onTableChange = async (tableName: any) => {
      state.model.tableName = tableName
      if (props.nodeType === 'sink' && state.model.database) {
        await getTableOptions(state.model.database, '')
      }
      if (props.nodeType === 'source' && !isLocalFileSource()) {
        await refreshIncrementalColumnOptions()
      }
      emit('tableNameChange', state.model)
    }

    const prevQueryTableName = ref('')
    const onTableSearch = debounce(async (tableName: any) => {
      // If it is a sink node and there is input content.
      if (props.nodeType === 'sink' && tableName) {
        try {
          // rely on database
          if (state.model.database && prevQueryTableName.value !== tableName) {
            await getTableOptions(state.model.database, tableName)
            prevQueryTableName.value = tableName

            // If there are no results after searching, add user input as a custom value to the options
            const existingOption = state.tableOptions.find(
              (option: TableOption) => option.value === tableName
            )

            if (!existingOption) {
              const newOption: TableOption = {
                label: tableName,
                value: tableName
              }
              state.tableOptions = [...state.tableOptions, newOption]
            }
          }
        } catch (err) {
          // If the interface call fails, also use user input as a custom value
          const existingOption = state.tableOptions.find(
            (option: TableOption) => option.value === tableName
          )

          if (!existingOption) {
            const newOption: TableOption = {
              label: tableName,
              value: tableName
            }
            state.tableOptions = [...state.tableOptions, newOption]
          }
        }
      } else {
        // The source node maintains its original logic
        if (state.model.database && prevQueryTableName.value !== tableName) {
          getTableOptions(state.model.database, tableName)
          prevQueryTableName.value = tableName
        }
      }
    }, 1000)

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
                t('project.synchronization_definition.local_file_schema_required')
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
                disabled={isLocalFileSource()}
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
                    getDatabaseOptions(v, option)
                    state.model.database = null
                    state.model.tableName = null
                    clearIncrementalValues()
                    state.formFieldNames = []
                    state.tableOptions = []
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
                label={t('project.synchronization_definition.local_file_format')}
              >
                <NSelect
                  disabled
                  options={localFileFormatOptions}
                  v-model={[state.model.localFileFormat, 'value']}
                />
              </NFormItem>
              <NFormItem label='encoding'>
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
                      v-model={[
                        state.model.skip_header_row_number,
                        'value'
                      ]}
                    />
                  </NFormItem>
                </>
              )}
              <NFormItem
                label={t('project.synchronization_definition.local_file_schema')}
              >
                <NSpace vertical style={{ width: '100%' }}>
                  <NSpace>
                    <NButton
                      type='primary'
                      secondary
                      loading={state.localFilePreviewLoading}
                      onClick={previewLocalFileData}
                    >
                      {t('project.synchronization_definition.local_file_preview')}
                    </NButton>
                    <NButton onClick={addLocalFileField}>
                      {t('project.synchronization_definition.local_file_add_field')}
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
                label={t('project.synchronization_definition.local_file_preview')}
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

          {props.nodeType !== 'transform' && !isLocalFileSource() && (
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
                    clearIncrementalValues()
                  }
                }}
              />
            </NFormItem>
          )}

          {dagStore.getDagInfo.jobType === 'DATA_INTEGRATION' &&
            (props.nodeType === 'sink' || props.nodeType === 'source') &&
            !isLocalFileSource() && (
              <NFormItem
                label={t('project.synchronization_definition.table_name')}
                path='tableName'
              >
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
                  tag={props.nodeType === 'sink'}
                  showArrow={true}
                  allowInput={props.nodeType === 'sink'}
                  placeholder={t(
                    'project.synchronization_definition.target_name_tips'
                  )}
                />
              </NFormItem>
            )}

          {state.model.sceneMode === 'MULTIPLE_TABLE' && !isLocalFileSource() && (
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

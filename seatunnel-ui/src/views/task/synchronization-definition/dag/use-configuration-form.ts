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

import { reactive, watch } from 'vue'
import _, { cloneDeep, find, omit } from 'lodash'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useFormField } from '@/components/dynamic-form/use-form-field'
import { useFormRequest } from '@/components/dynamic-form/use-form-request'
import { useFormValidate } from '@/components/dynamic-form/use-form-validate'
import { useFormStructure } from '@/components/dynamic-form/use-form-structure'
import {
  listSourceName,
  getDatabaseByDatasource,
  getTableByDatabase,
  getFormStructureByDatasourceInstance,
  getColumnProjection,
  findSink,
  getInputTableSchema
} from '@/service/sync-task-definition'
import { getDatasourceDetail } from '@/service/data-source'
import { previewLocalFile } from '@/service/local-file'
import type { JdbcIncrementalColumnType } from '@/service/sync-task-definition'
import { useSynchronizationDefinitionStore } from '@/store/synchronization-definition'
import { getDefaultNodeName, isComponentDefaultName } from './component-display'
import type { NodeType, TableOption } from './types'

const EXTRACT_MODE_FIELD = 'extract_mode'
const INCREMENTAL_COLUMN_FIELD = 'incremental_column'
const INCREMENTAL_COLUMN_TYPE_FIELD = 'incremental_column_type'
type TableSchemaField = {
  name: string
  type?: string
  outputDataType?: string
  nullable?: boolean
  primaryKey?: boolean
  defaultValue?: string
  comment?: string
  unSupport?: boolean
}

export const useConfigurationForm = (
  nodeType: NodeType,
  transformType: string,
  sourceKind = ''
) => {
  const { t } = useI18n()
  const dagStore = useSynchronizationDefinitionStore()
  const route = useRoute()
  const initialModel = {
    name: '',
    datasourceInstanceId: null,
    datasourceInstanceName: null,
    sceneMode: null,
    database: null as null | string | string[],
    tableName: null as null | string | string[],
    kinds: [],
    kind: 0,
    columnSelectable: false,
    pluginName: '',
    datasourceName: '',
    query: '',
    sourceKind,
    localFilePath: '',
    localFileFormat: '',
    localFilePreviewRows: [] as Record<string, any>[],
    localFileSchemaFields: [] as TableSchemaField[],
    localFileWarnings: [] as string[],
    csv_use_header_line: true,
    skip_header_row_number: 0,
    encoding: 'UTF-8'
  }

  const state = reactive<{
    model: typeof initialModel
    loading: boolean
    datasourceOptions: any[]
    datasourceLoading: boolean
    databaseOptions: any[]
    databaseLoading: boolean
    tableOptions: TableOption[]
    tableLoading: boolean
    formStructure: any[]
    formFieldNames: string[]
    formLocales: any
    formName: string
    formLoading: boolean
    inputTableData: any[]
    outputTableData: any[]
    tableColumnsLoading: boolean
    incrementalColumnLoading: boolean
    incrementalColumnTypeMap: Record<string, JdbcIncrementalColumnType>
    localFilePreviewLoading: boolean
    rules: any
  }>({
    model: cloneDeep(initialModel),
    loading: false,
    datasourceOptions: [],
    datasourceLoading: false,
    databaseOptions: [],
    databaseLoading: false,
    tableOptions: [],
    tableLoading: false,
    formStructure: [],
    formFieldNames: [],
    formLocales: {},
    formName: '',
    formLoading: false,
    inputTableData: [],
    outputTableData: [],
    tableColumnsLoading: false,
    incrementalColumnLoading: false,
    incrementalColumnTypeMap: {},
    localFilePreviewLoading: false,
    rules: {
      name: {
        required: true,
        trigger: ['input', 'blur'],
        validator: (ignore: any, value: string) => {
          if (!value) {
            return new Error(
              t('project.synchronization_definition.node_name_validate')
            )
          }
        }
      },
      datasourceInstanceId: {
        required: true,
        trigger: ['input', 'blur'],
        validator: (ignore: any, value: string) => {
          if (!value) {
            return new Error(
              t('project.synchronization_definition.source_name_validate')
            )
          }
        }
      },
      sceneMode: {
        required: true,
        trigger: ['input', 'blur'],
        validator: (ignore: any, value: string) => {
          if (!value) {
            return new Error(
              t('project.synchronization_definition.scene_mode_validate')
            )
          }
        }
      },
      database: {
        required: true,
        trigger: ['input', 'blur'],
        validator: (ignore: any, value: string) => {
          if (!value) {
            return new Error(
              t('project.synchronization_definition.database_validate')
            )
          }
        }
      },
      tableName: {
        required: true,
        trigger: ['input', 'blur'],
        validator: (ignore: any, value: string) => {
          if (!value) {
            return new Error(
              t('project.synchronization_definition.table_name_validate')
            )
          }
        }
      },
      kinds: {
        required: true,
        trigger: ['input', 'blur'],
        validator: () => {
          if (state.model.kinds.length === 0) {
            return new Error(
              state.model.kind
                ? t('project.synchronization_definition.exclude_kind_validate')
                : t('project.synchronization_definition.include_kind_validate')
            )
          }
        }
      },
      query: {
        required: true,
        trigger: ['input', 'blur'],
        validator: (ignore: any, value: string) => {
          if (!value) {
            return new Error(
              t('project.synchronization_definition.query_validate')
            )
          }
        }
      }
    }
  })

  let incrementalSchemaRequestId = 0

  const hasIncrementalFields = () =>
    state.formFieldNames.includes(EXTRACT_MODE_FIELD) &&
    state.formFieldNames.includes(INCREMENTAL_COLUMN_FIELD)

  const getIncrementalFormField = (field: string) =>
    state.formStructure.find((form) => form.field === field)

  const getSingleValue = (value: null | string | string[]) =>
    Array.isArray(value) ? value[0] || null : value

  const isLocalFileSource = () =>
    nodeType === 'source' &&
    (state.model.sourceKind === 'LOCAL_FILE' ||
      state.model.datasourceName === 'LocalFile' ||
      transformType === 'LocalFile')

  const getLocalFileTableName = (path: string) => {
    const fileName = String(path || '').split(/[\\/]/).pop() || 'local_file'
    const dotIndex = fileName.lastIndexOf('.')
    const baseName = dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName
    return baseName.replace(/[^A-Za-z0-9_]/g, '_') || 'local_file'
  }

  const syncLocalFileTableOptions = () => {
    const tableName = getLocalFileTableName(state.model.localFilePath)
    state.databaseOptions = [{ label: 'default', value: 'default' }]
    state.tableOptions = [{ label: tableName, value: tableName }]
    state.model.database = 'default'
    state.model.tableName = tableName
  }

  const decorateIncrementalFormFields = (forms: Array<any>) => {
    if (nodeType !== 'source') return forms

    forms.forEach((form) => {
      if (form.field === INCREMENTAL_COLUMN_FIELD) {
        form.type = 'select'
        form.options = []
        form.filterable = true
        form.clearable = true
        form.placeholder =
          'project.synchronization_definition.incremental_column_placeholder'
      }
      if (form.field === INCREMENTAL_COLUMN_TYPE_FIELD) {
        delete form.validate
        form.hidden = true
      }
    })

    return forms
  }

  const setIncrementalColumnOptions = (options: TableOption[]) => {
    const incrementalColumnForm = getIncrementalFormField(
      INCREMENTAL_COLUMN_FIELD
    )
    if (!incrementalColumnForm) return
    incrementalColumnForm.options = options
    incrementalColumnForm.disabled = options.length === 0
  }

  const clearIncrementalValues = () => {
    const model = state.model as Record<string, any>
    model[INCREMENTAL_COLUMN_FIELD] = null
    model[INCREMENTAL_COLUMN_TYPE_FIELD] = null
  }

  const resetIncrementalColumnOptions = () => {
    state.incrementalColumnTypeMap = {}
    setIncrementalColumnOptions([])
    clearIncrementalValues()
  }

  const normalizeDataType = (field: TableSchemaField) =>
    String(field.outputDataType || field.type || '')
      .trim()
      .toUpperCase()

  const resolveIncrementalColumnType = (
    field: TableSchemaField
  ): JdbcIncrementalColumnType | null => {
    const normalizedType = normalizeDataType(field)
    if (!normalizedType) return null

    if (
      /(TIMESTAMP|TIMESTAMP_NTZ|TIMESTAMP_LTZ|TIMESTAMP_TZ|TIMESTAMP_WITH|TIMESTAMP WITHOUT)/.test(
        normalizedType
      )
    ) {
      return 'TIMESTAMP'
    }
    if (
      /(DATETIME|SMALLDATETIME|DATE_TIME|LOCAL_DATE_TIME)/.test(normalizedType)
    ) {
      return 'DATETIME'
    }
    if (/(^DATE$|LOCAL_DATE)/.test(normalizedType)) {
      return 'DATE'
    }
    if (
      /(NUMBER|NUMERIC|DECIMAL|BIGINT|INT|INTEGER|SMALLINT|TINYINT|FLOAT|DOUBLE|REAL|SERIAL|MONEY|BINARY_FLOAT|BINARY_DOUBLE)/.test(
        normalizedType
      )
    ) {
      return 'NUMBER'
    }

    return null
  }

  const syncIncrementalColumnType = () => {
    if (!hasIncrementalFields()) return

    const model = state.model as Record<string, any>
    const selectedColumn = model[INCREMENTAL_COLUMN_FIELD]
    if (!selectedColumn) {
      model[INCREMENTAL_COLUMN_TYPE_FIELD] = null
      return
    }

    model[INCREMENTAL_COLUMN_TYPE_FIELD] =
      state.incrementalColumnTypeMap[String(selectedColumn)] || null
  }

  const refreshIncrementalColumnOptions = async () => {
    if (nodeType !== 'source' || !hasIncrementalFields()) return

    const datasourceInstanceId = state.model.datasourceInstanceId
    const database = getSingleValue(state.model.database)
    const tableName = getSingleValue(state.model.tableName)

    if (!datasourceInstanceId || !database || !tableName) {
      resetIncrementalColumnOptions()
      return
    }

    const requestId = ++incrementalSchemaRequestId
    state.incrementalColumnLoading = true
    try {
      const schemaFields = await getInputTableSchema(
        datasourceInstanceId,
        database,
        tableName
      )

      if (requestId !== incrementalSchemaRequestId) return

      const nextTypeMap = schemaFields.reduce(
        (
          accumulator: Record<string, JdbcIncrementalColumnType>,
          field: TableSchemaField
        ) => {
          const incrementalType = resolveIncrementalColumnType(field)
          if (incrementalType) {
            accumulator[field.name] = incrementalType
          }
          return accumulator
        },
        {}
      )

      const options = schemaFields
        .filter((field: TableSchemaField) => nextTypeMap[field.name])
        .map((field: TableSchemaField) => ({
          label: `${field.name} (${field.outputDataType || field.type || '-'})`,
          value: field.name
        }))

      state.incrementalColumnTypeMap = nextTypeMap
      setIncrementalColumnOptions(options)

      const model = state.model as Record<string, any>
      if (
        model[INCREMENTAL_COLUMN_FIELD] &&
        !nextTypeMap[String(model[INCREMENTAL_COLUMN_FIELD])]
      ) {
        clearIncrementalValues()
      } else {
        syncIncrementalColumnType()
      }
    } catch (error) {
      if (requestId !== incrementalSchemaRequestId) return
      resetIncrementalColumnOptions()
    } finally {
      if (requestId === incrementalSchemaRequestId) {
        state.incrementalColumnLoading = false
      }
    }
  }

  watch(
    () => (state.model as Record<string, any>)[INCREMENTAL_COLUMN_FIELD],
    () => {
      syncIncrementalColumnType()
    }
  )

  const getDatasourceOptions = async (sceneMode: string) => {
    if (state.datasourceLoading) return
    state.datasourceLoading = true
    try {
      const result = await listSourceName(
        route.params.jobDefinitionCode as string,
        sceneMode
      )
      const options = result.map((item: any) => ({
        label: item.dataSourceInstanceName,
        value: item.dataSourceInstanceId,
        pluginName:
          item.dataSourceInfo?.connectorInfo?.pluginIdentifier.pluginName,
        datasourceName: item.dataSourceInfo?.datasourceName
      }))
      state.datasourceOptions =
        state.model.sourceKind === 'LOCAL_FILE'
          ? options.filter((item: any) => item.datasourceName === 'LocalFile')
          : options
    } finally {
      state.datasourceLoading = false
    }
  }

  const getDatabaseOptions = async (
    datasourceInstanceId: string,
    option?: any
  ) => {
    if (option?.label) state.model.datasourceInstanceName = option.label
    if (option?.datasourceName) {
      state.model.datasourceName = option.datasourceName
      if (option.datasourceName !== 'LocalFile') {
        getColumnSelectable(option.datasourceName)
      }
    }
    if (option?.pluginName) state.model.pluginName = option.pluginName
    if (option?.datasourceName === 'LocalFile') {
      const datasourceDetail = await getDatasourceDetail(datasourceInstanceId)
      const datasourceConfig = datasourceDetail.datasourceConfig || {}
      state.model.localFilePath = datasourceConfig.path || ''
      state.model.localFileFormat =
        (datasourceConfig.file_format_type || '').toLowerCase()
      state.model.encoding = datasourceConfig.encoding || 'UTF-8'
      state.model.sceneMode = 'SINGLE_TABLE'
      state.model.columnSelectable = false
      syncLocalFileTableOptions()
      await getFormStructure(datasourceInstanceId)
      await previewLocalFileData()
      return
    }
    if (state.databaseLoading) return
    state.databaseLoading = true
    try {
      if (nodeType !== 'transform') {
        const result = await getDatabaseByDatasource(option.label)
        state.databaseOptions = result.map((item: string) => ({
          label: item,
          value: item
        }))
      }
      await getFormStructure(datasourceInstanceId)
    } finally {
      state.databaseLoading = false
    }
  }

  const getTableOptions = async (
    databases: Array<string> | string,
    filterName?: string,
    size?: number
  ) => {
    filterName = filterName || ''
    if (
      nodeType === 'source' ||
      (dagStore.getDagInfo.jobType === 'DATA_INTEGRATION' &&
        nodeType === 'sink')
    ) {
      if (state.tableLoading) return
      if (_.isArray(databases) && databases.length === 0) {
        state.tableOptions = []
        return
      }
      state.tableLoading = true
      try {
        const result = await getTableByDatabase(
          state.model.datasourceInstanceName || '',
          typeof databases === 'string' ? databases : databases[0],
          filterName,
          size
        )
        state.tableOptions = result.map((item: any) => ({
          label: item,
          value: item
        }))
      } finally {
        state.tableLoading = false
      }
      return
    }
  }

  const getSinks = async () => {
    try {
      if (state.datasourceLoading) return
      state.datasourceLoading = true
      const result = await findSink(route.params.jobDefinitionCode as string)
      state.datasourceOptions = result.map((item: any) => ({
        label: item.dataSourceInstanceName,
        value: item.dataSourceInstanceId,
        pluginName:
          item.dataSourceInfo?.connectorInfo?.pluginIdentifier.pluginName,
        datasourceName: item.dataSourceInfo?.datasourceName
      }))
    } finally {
      state.datasourceLoading = false
    }
  }

  const getFormStructure = async (datasourceInstanceId = '') => {
    if (state.formLoading) return
    state.formLoading = true
    state.formFieldNames = []
    try {
      const params = {
        jobCode: Number(route.params.jobDefinitionCode) as number,
        connectorType: nodeType
      } as {
        connectorType: string
        connectorName?: string
        dataSourceInstanceId?: string
        jobCode: number
      }
      if (nodeType === 'transform') params.connectorName = transformType
      if (nodeType !== 'transform')
        params.dataSourceInstanceId = datasourceInstanceId
      const resJson = await getFormStructureByDatasourceInstance(params)
      if (resJson === 'null') return
      const res = JSON.parse(resJson)
      state.formName = res.name
      res.forms = res.forms.filter(
        (form: { field: string }) =>
          !['exclude_kinds', 'include_kinds'].includes(form.field)
      )
      res.forms = decorateIncrementalFormFields(res.forms)
      state.formFieldNames = res.forms.map(
        (form: { field: string }) => form.field
      )
      state.formLocales = res.locales
      Object.assign(state.model, useFormField(res.forms))
      Object.assign(state.rules, useFormValidate(res.forms, state.model, t))
      state.formStructure = (
        useFormStructure(
          res.apis ? useFormRequest(res.apis, res.forms) : res.forms
        ) as any
      ).filter((form: { hidden?: boolean }) => !form.hidden)
    } finally {
      state.formLoading = false
    }
  }

  const getColumnSelectable = async (pluginName: string) => {
    if (state.model.sceneMode !== 'SINGLE_TABLE') {
      state.model.columnSelectable = false
      return
    }
    if (dagStore.getColumnSelectable(pluginName) !== undefined) {
      state.model.columnSelectable = dagStore.getColumnSelectable(pluginName)
      return
    }
    const res = await getColumnProjection(pluginName)
    state.model.columnSelectable = res
    dagStore.setColumnSelectable(pluginName, res)
  }

  const normalizeLocalFileFields = (fields: TableSchemaField[]) =>
    fields.map((field) => ({
      name: field.name,
      type: field.outputDataType || field.type || 'STRING',
      outputDataType: field.outputDataType || field.type || 'STRING',
      nullable: field.nullable ?? true,
      primaryKey: field.primaryKey ?? false,
      defaultValue: field.defaultValue || '',
      comment: field.comment || '',
      unSupport: field.unSupport ?? false
    }))

  const previewLocalFileData = async () => {
    if (!state.model.localFilePath) return
    state.localFilePreviewLoading = true
    try {
      const result = await previewLocalFile({
        path: state.model.localFilePath,
        fileFormatType: state.model.localFileFormat,
        encoding: state.model.encoding || 'UTF-8',
        csvUseHeaderLine: state.model.csv_use_header_line,
        skipHeaderRowNumber: Number(state.model.skip_header_row_number || 0),
        limit: 20
      })
      state.model.localFilePreviewRows = result.rows || []
      state.model.localFileWarnings = result.warnings || []
      state.model.localFileSchemaFields = normalizeLocalFileFields(
        result.fields || []
      )
      syncLocalFileTableOptions()
    } finally {
      state.localFilePreviewLoading = false
    }
  }

  const updateFormValues = async (values: any) => {
    if (state.loading) return
    state.loading = true
    try {
      state.model.sourceKind = values.sourceKind || sourceKind || ''
      state.model.datasourceInstanceId = values.dataSourceId
      const localizedDefaultName = getDefaultNodeName(
        nodeType,
        transformType,
        t
      )
      state.model.name =
        isComponentDefaultName(values.name) && localizedDefaultName
          ? localizedDefaultName
          : values.name
      state.model.sceneMode = values.sceneMode
      if (state.model.sourceKind === 'LOCAL_FILE' && !state.model.sceneMode) {
        state.model.sceneMode = 'SINGLE_TABLE'
      }
      if (values.sceneMode === 'SPLIT_TABLE') {
        state.model.database = values.tableOption?.databases || []
      } else {
        state.model.database = values.tableOption?.databases?.length
          ? values.tableOption.databases[0]
          : null
      }

      if (state.model.sceneMode) {
        await getDatasourceOptions(state.model.sceneMode)
      }
      if (nodeType === 'sink') {
        await getSinks()
      }

      if (values.dataSourceId) {
        const option = find(
          state.datasourceOptions,
          (item: { value: string }) => item.value === values.dataSourceId
        )
        await getDatabaseOptions(values.dataSourceId, option)
      }
      if (nodeType === 'transform') {
        await getFormStructure()
      }

      if (values.tableOption?.databases?.length) {
        await getTableOptions(
          values.tableOption.databases[0],
          '',
          state.model.sceneMode === 'MULTIPLE_TABLE' ? 9999999 : 100
        )
      }

      if (values.sceneMode === 'MULTIPLE_TABLE') {
        state.model.tableName = values.tableOption?.tables || []
      } else {
        state.model.tableName = values.tableOption?.tables.length
          ? values.tableOption.tables[0]
          : null
      }

      if (values.config) {
        const config = JSON.parse(values.config)
        Object.assign(
          state.model,
          omit(config, ['exclude_kinds', 'include_kinds'])
        )
        if (config.exclude_kinds || config.include_kinds) {
          state.model.kind = config.exclude_kinds ? 1 : 0
          state.model.kinds = JSON.parse(
            config.exclude_kinds || config.include_kinds
          )
        }
      }
      if (
        isLocalFileSource() &&
        values.outputSchema &&
        values.outputSchema.length
      ) {
        state.model.localFileSchemaFields = normalizeLocalFileFields(
          values.outputSchema[0].fields || []
        )
      }
      await refreshIncrementalColumnOptions()
    } finally {
      state.loading = false
    }
  }

  return {
    state,
    dagStore,
    getDatasourceOptions,
    getDatabaseOptions,
    getTableOptions,
    getFormStructure,
    previewLocalFileData,
    isLocalFileSource,
    getLocalFileTableName,
    clearIncrementalValues,
    refreshIncrementalColumnOptions,
    updateFormValues,
    getSinks
  }
}

export const getSceneModeOptions = (jobType: string, t: Function) => {
  return [
    {
      label: t('project.synchronization_definition.multi_table_sync'),
      value: 'MULTIPLE_TABLE',
      disabled: jobType === 'DATA_INTEGRATION'
    },
    {
      label: t('project.synchronization_definition.sub_library_and_sub_table'),
      value: 'SPLIT_TABLE',
      disabled: jobType === 'DATA_REPLICA'
    },
    {
      label: t('project.synchronization_definition.single_table_sync'),
      value: 'SINGLE_TABLE',
      disabled: jobType === 'DATA_REPLICA'
    }
  ]
}

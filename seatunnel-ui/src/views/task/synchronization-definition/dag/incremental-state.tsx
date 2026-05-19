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

import { computed, defineComponent, PropType, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import {
  NAlert,
  NButton,
  NDescriptions,
  NDescriptionsItem,
  NPopconfirm,
  NSpace,
  NSpin,
  NTag
} from 'naive-ui'
import {
  getJobIncrementalState,
  resetJobIncrementalState
} from '@/service/sync-task-definition'
import type {
  JdbcIncrementalColumnType,
  JdbcIncrementalExtractMode,
  JobIncrementalStateRes
} from '@/service/sync-task-definition'
import type { NodeType } from './types'

type IncrementalStateFormContext = {
  loading: boolean
  values: Record<string, any>
  fieldNames: string[]
}

const REQUIRED_INCREMENTAL_FIELDS = [
  'extract_mode',
  'incremental_column',
  'incremental_column_type'
]

const props = {
  active: {
    type: Boolean as PropType<boolean>,
    default: false
  },
  nodeType: {
    type: String as PropType<NodeType>,
    required: true
  },
  pluginId: {
    type: String as PropType<string>,
    required: true
  },
  contextProvider: {
    type: Function as PropType<() => IncrementalStateFormContext>,
    required: true
  }
}

const IncrementalState = defineComponent({
  name: 'IncrementalState',
  props,
  setup(props) {
    const { t } = useI18n()
    const route = useRoute()
    const jobDefineId = computed(() => Number(route.params.jobDefinitionCode))
    const state = reactive({
      loading: false,
      resetLoading: false,
      lastLoadedKey: '',
      incrementalState: null as JobIncrementalStateRes | null
    })

    const getContextSnapshot = () => {
      const context = props.contextProvider()
      const fieldNames = Array.isArray(context.fieldNames)
        ? context.fieldNames
        : []

      const normalizeEnumValue = (value: any) => {
        if (typeof value !== 'string') return undefined
        const trimmed = value.trim()
        return trimmed ? trimmed.toUpperCase() : undefined
      }

      const normalizeTextValue = (value: any) => {
        if (value === undefined || value === null) return undefined
        const trimmed = String(value).trim()
        return trimmed || undefined
      }

      return {
        loading: Boolean(context.loading),
        fieldNames,
        extractMode: normalizeEnumValue(
          context.values?.extract_mode
        ) as JdbcIncrementalExtractMode | undefined,
        incrementalColumn: normalizeTextValue(
          context.values?.incremental_column
        ),
        incrementalColumnType: normalizeEnumValue(
          context.values?.incremental_column_type
        ) as JdbcIncrementalColumnType | undefined
      }
    }

    const getQueryState = () => {
      const snapshot = getContextSnapshot()
      const supported = REQUIRED_INCREMENTAL_FIELDS.every((field) =>
        snapshot.fieldNames.includes(field)
      )
      const enabled = snapshot.extractMode === 'INCREMENTAL'
      const canQuery =
        props.active &&
        props.nodeType === 'source' &&
        !snapshot.loading &&
        supported &&
        enabled &&
        Number.isFinite(jobDefineId.value) &&
        Boolean(props.pluginId)

      return {
        snapshot,
        supported,
        enabled,
        canQuery,
        key: [
          jobDefineId.value,
          props.pluginId,
          snapshot.extractMode || '',
          snapshot.incrementalColumn || '',
          snapshot.incrementalColumnType || ''
        ].join('|')
      }
    }

    const hasStateRecord = computed(() => {
      const incrementalState = state.incrementalState
      if (!incrementalState) return false
      return Boolean(
        incrementalState.lastSuccessValue ||
          incrementalState.updateTime ||
          incrementalState.incrementalColumn ||
          incrementalState.incrementalColumnType
      )
    })

    const loadIncrementalState = async (force = false) => {
      const queryState = getQueryState()
      if (!queryState.canQuery) {
        state.incrementalState = null
        state.lastLoadedKey = ''
        return
      }
      if (state.loading) return
      if (!force && state.lastLoadedKey === queryState.key) return

      state.loading = true
      try {
        state.incrementalState = await getJobIncrementalState(
          jobDefineId.value,
          props.pluginId
        )
        state.lastLoadedKey = queryState.key
      } finally {
        state.loading = false
      }
    }

    const onRefresh = async () => {
      await loadIncrementalState(true)
    }

    const onReset = async () => {
      if (
        state.resetLoading ||
        !Number.isFinite(jobDefineId.value) ||
        !hasStateRecord.value
      ) {
        return
      }

      state.resetLoading = true
      try {
        await resetJobIncrementalState({
          jobDefineId: jobDefineId.value,
          pluginId: props.pluginId
        })
        window.$message.success(
          t('project.synchronization_definition.incremental_state_reset_success')
        )
        state.lastLoadedKey = ''
        await loadIncrementalState(true)
      } finally {
        state.resetLoading = false
      }
    }

    watch(
      () => {
        const snapshot = getContextSnapshot()
        return [
          props.active,
          props.nodeType,
          props.pluginId,
          snapshot.loading,
          snapshot.fieldNames.join(','),
          snapshot.extractMode || '',
          snapshot.incrementalColumn || '',
          snapshot.incrementalColumnType || ''
        ].join('|')
      },
      async () => {
        const queryState = getQueryState()
        if (!queryState.canQuery) {
          state.incrementalState = null
          state.lastLoadedKey = ''
          return
        }
        await loadIncrementalState()
      },
      {
        immediate: true
      }
    )

    const renderExtractMode = (value?: JdbcIncrementalExtractMode) => {
      if (!value) return '-'
      return (
        <NTag size='small' type={value === 'INCREMENTAL' ? 'success' : 'default'}>
          {t(
            `project.synchronization_definition.incremental_state_extract_mode_${value.toLowerCase()}`
          )}
        </NTag>
      )
    }

    const renderColumnType = (value?: JdbcIncrementalColumnType) => {
      if (!value) return '-'
      return (
        <NTag size='small'>
          {t(
            `project.synchronization_definition.incremental_state_column_type_${value.toLowerCase()}`
          )}
        </NTag>
      )
    }

    return () => {
      const queryState = getQueryState()
      const displayIncrementalColumn =
        state.incrementalState?.incrementalColumn ||
        queryState.snapshot.incrementalColumn
      const displayIncrementalColumnType =
        state.incrementalState?.incrementalColumnType ||
        queryState.snapshot.incrementalColumnType
      const refreshDisabled =
        queryState.snapshot.loading ||
        state.loading ||
        !queryState.supported ||
        !queryState.enabled
      const resetDisabled =
        refreshDisabled || state.resetLoading || !hasStateRecord.value

      return (
        <NSpin show={queryState.snapshot.loading || state.loading}>
          <div style={{ minHeight: '240px', paddingTop: '4px' }}>
            {!queryState.snapshot.loading && (
              <NSpace vertical size={16}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ flex: '1 1 320px' }}>
                    {!queryState.supported && (
                      <NAlert type='warning' showIcon={false}>
                        {t(
                          'project.synchronization_definition.incremental_state_not_supported'
                        )}
                      </NAlert>
                    )}
                    {queryState.supported && !queryState.enabled && (
                      <NAlert type='warning' showIcon={false}>
                        {t(
                          'project.synchronization_definition.incremental_state_disabled'
                        )}
                      </NAlert>
                    )}
                    {queryState.supported && queryState.enabled && (
                      <NAlert type='info' showIcon={false}>
                        {t(
                          'project.synchronization_definition.incremental_state_hint'
                        )}
                      </NAlert>
                    )}
                  </div>
                  <NSpace>
                    <NButton
                      secondary
                      onClick={onRefresh}
                      disabled={refreshDisabled}
                      loading={state.loading}
                    >
                      {t(
                        'project.synchronization_definition.incremental_state_refresh'
                      )}
                    </NButton>
                    <NPopconfirm
                      positiveText={t('project.synchronization_definition.confirm')}
                      negativeText={t('project.synchronization_definition.cancel')}
                      onPositiveClick={onReset}
                    >
                      {{
                        trigger: () => (
                          <NButton
                            secondary
                            type='error'
                            disabled={resetDisabled}
                            loading={state.resetLoading}
                          >
                            {t(
                              'project.synchronization_definition.incremental_state_reset'
                            )}
                          </NButton>
                        ),
                        default: () =>
                          t(
                            'project.synchronization_definition.incremental_state_reset_content'
                          )
                      }}
                    </NPopconfirm>
                  </NSpace>
                </div>

                {queryState.supported &&
                  queryState.enabled &&
                  !hasStateRecord.value && (
                    <NAlert type='default' showIcon={false}>
                      {t(
                        'project.synchronization_definition.incremental_state_empty'
                      )}
                    </NAlert>
                  )}

                {queryState.supported && queryState.enabled && (
                  <NDescriptions bordered labelPlacement='left' column={1}>
                    <NDescriptionsItem
                      label={t(
                        'project.synchronization_definition.incremental_state_extract_mode'
                      )}
                    >
                      {renderExtractMode(queryState.snapshot.extractMode)}
                    </NDescriptionsItem>
                    <NDescriptionsItem
                      label={t(
                        'project.synchronization_definition.incremental_state_column'
                      )}
                    >
                      {displayIncrementalColumn || '-'}
                    </NDescriptionsItem>
                    <NDescriptionsItem
                      label={t(
                        'project.synchronization_definition.incremental_state_column_type'
                      )}
                    >
                      {renderColumnType(displayIncrementalColumnType)}
                    </NDescriptionsItem>
                    <NDescriptionsItem
                      label={t(
                        'project.synchronization_definition.incremental_state_last_success_value'
                      )}
                    >
                      {state.incrementalState?.lastSuccessValue || '-'}
                    </NDescriptionsItem>
                    <NDescriptionsItem
                      label={t(
                        'project.synchronization_definition.incremental_state_update_time'
                      )}
                    >
                      {state.incrementalState?.updateTime || '-'}
                    </NDescriptionsItem>
                  </NDescriptions>
                )}
              </NSpace>
            )}
          </div>
        </NSpin>
      )
    }
  }
})

export default IncrementalState

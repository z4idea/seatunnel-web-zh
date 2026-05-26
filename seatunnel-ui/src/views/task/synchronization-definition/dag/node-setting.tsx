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

import { defineComponent, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NDrawer,
  NDrawerContent,
  NSpace,
  NButton,
  NTabs,
  NTabPane
} from 'naive-ui'
import { useNodeSettingModal } from './use-node-setting'
import NodeModeModal from './node-model'
import ConfigurationForm from './configuration-form'
import IncrementalState from './incremental-state'
import type { PropType } from 'vue'
import type { NodeInfo } from './types'

const props = {
  show: {
    type: Boolean as PropType<boolean>,
    default: false
  },
  nodeInfo: {
    type: Object as PropType<NodeInfo>,
    default: () => ({}) as NodeInfo
  }
}

const NodeSetting = defineComponent({
  name: 'SettingNodeModal',
  props,
  emits: ['cancelModal', 'confirmModal'],
  setup(props, ctx) {
    const { t } = useI18n()
    const {
      state,
      configurationFormRef,
      modelRef,
      onSave,
      handleTab,
      handleChangeTable
    } = useNodeSettingModal(props, ctx)

    const cancelModal = () => {
      state.tab = 'configuration'
      state.width = '60%'
      ctx.emit('cancelModal', props.show)
    }

    const isLocalFileSource = () =>
      props.nodeInfo.type === 'source' &&
      (props.nodeInfo.sourceKind === 'LOCAL_FILE' ||
        props.nodeInfo.connectorType === 'LocalFile')

    const isHttpSource = () =>
      props.nodeInfo.type === 'source' &&
      (props.nodeInfo.sourceKind === 'HTTP_API' ||
        props.nodeInfo.connectorType === 'Http' ||
        props.nodeInfo.datasourceName === 'Http')

    watch(
      () => props.show,
      async () => {
        await nextTick()

        if (props.show && configurationFormRef.value) {
          await configurationFormRef.value.setValues(props.nodeInfo)
        }
        if (props.show && modelRef.value) {
          modelRef.value.setSelectFields(
            props.nodeInfo.selectTableFields?.tableFields || []
          )
        }
      }
    )

    return () => (
<<<<<<< HEAD
      <NDrawer show={props.show} width={state.width} zIndex={1000}>
        <NDrawerContent>
=======
      <NModal
        show={props.show}
        zIndex={1000}
        maskClosable={false}
        closeOnEsc={false}
        onUpdateShow={(show) => {
          if (!show) {
            cancelModal()
          }
        }}
      >
        <NCard
          bordered={false}
          style={{
            width: state.width,
            maxWidth: '92vw'
          }}
          contentStyle={{
            maxHeight: '72vh',
            overflowY: 'auto'
          }}
        >
>>>>>>> 3697ed0dbb0d04788611b3abb72e6361ed28e0fe
          {{
            default: () => (
              <NTabs onUpdateValue={handleTab} value={state.tab}>
                <NTabPane
                  name='configuration'
                  tab={t('project.synchronization_definition.configuration')}
                  displayDirective='show'
                >
                  <ConfigurationForm
                    nodeType={props.nodeInfo.type}
                    nodeId={props.nodeInfo.pluginId}
                    transformType={props.nodeInfo.connectorType}
                    sourceKind={props.nodeInfo.sourceKind}
                    ref={configurationFormRef}
                    onTableNameChange={handleChangeTable}
                  />
                </NTabPane>
                <NTabPane
                  name='model'
                  tab={t('project.synchronization_definition.model')}
                  displayDirective='show'
                >
                  <NodeModeModal
                    ref={modelRef}
                    type={props.nodeInfo.type}
                    transformType={props.nodeInfo.connectorType}
                    predecessorsNodeId={props.nodeInfo.predecessorsNodeId}
                    currentNodeId={props.nodeInfo.pluginId}
                    schemaError={props.nodeInfo.schemaError}
                    refForm={configurationFormRef}
                  />
                </NTabPane>
                {props.nodeInfo.type === 'source' &&
                  !isLocalFileSource() &&
                  !isHttpSource() && (
                  <NTabPane
                    name='incremental-state'
                    tab={t(
                      'project.synchronization_definition.incremental_state'
                    )}
                    displayDirective='show'
                  >
                    <IncrementalState
                      active={state.tab === 'incremental-state'}
                      nodeType={props.nodeInfo.type}
                      pluginId={props.nodeInfo.pluginId}
                      contextProvider={() =>
                        configurationFormRef.value?.getIncrementalStateContext?.() || {
                          loading: false,
                          values: {},
                          fieldNames: []
                        }
                      }
                    />
                  </NTabPane>
                )}
              </NTabs>
            ),
            footer: () => (
              <NSpace>
                <NButton onClick={cancelModal}>
                  {t('project.synchronization_definition.cancel')}
                </NButton>
                <NButton onClick={onSave} type='primary'>
                  {t('project.synchronization_definition.confirm')}
                </NButton>
              </NSpace>
            )
          }}
        </NDrawerContent>
      </NDrawer>
    )
  }
})

export default NodeSetting

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
import { defineComponent, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { onBeforeRouteLeave, useRouter, useRoute } from 'vue-router'
import { DagSidebar } from './sidebar'
import { DagCanvas } from './canvas'
import { DagToolbar } from './toolbar'
import { NSpace, NSpin } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useDagDetail } from './use-dag-detail'
import styles from './index.module.scss'
import './index.css'

const SynchronizationDefinitionDag = defineComponent({
  name: 'SynchronizationDefinitionDag',
  setup() {
    const dagRef = ref()

    const tempNode = {
      type: '',
      name: '',
      sourceKind: ''
    }
    const { t, locale } = useI18n()
    const { state, detailInit, onDelete, onSave } = useDagDetail()
    const router = useRouter()
    const route = useRoute()
    const isSaving = ref(false)
    const isClosing = ref(false)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if(isSaving.value) return
      if(dagRef.value?.isCanvasDirty?.()) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    onBeforeRouteLeave((_to, _from, next) => {
      if (isSaving.value || isClosing.value) {
        next()
        return
      }
      if (dagRef.value?.isCanvasDirty?.()) {
        const answer = window.confirm(
          t('project.synchronization_definition.leave_confirm')
        )
        if (!answer) {
          next(false)
          return
        }
      }
      next()
    })
    const handelDragstart = (type: any, name: any, sourceKind = '') => {
      tempNode.type = type
      tempNode.name = name
      tempNode.sourceKind = sourceKind
    }

    const handelDrop = (e: DragEvent) => {
      if (!tempNode.type) return
      dagRef.value.addNode({
        clientX: e.clientX,
        clientY: e.clientY,
        label: tempNode.name || tempNode.type,
        node: tempNode.type,
        sourceKind: tempNode.sourceKind
      })
    }

    const handleDelete = async () => {
      const cells = dagRef.value.getSelectedCells()
      if (!cells.length) {
        window.$message.warning(
          t('project.synchronization_definition.delete_empty_tips')
        )
        return
      }
      let result = true
      if (cells[0].isNode() && !cells[0].getData().unsaved) {
        result = await onDelete(cells[0].getData().pluginId)
      }
      if (result) dagRef.value.removeCell(cells[0].id)
    }

    const handleSave = async() => {
      const result = dagRef.value.getDagData()
      if(result) {
        isSaving.value = true
        dagRef.value.markCanvasClean()
        await onSave(result, dagRef.value.getGraph())
        isSaving.value = false
      }
    }

    const doNavigateAway = () => {
      router.push({
        name: 'synchronization-definition',
        query: {
          project: route.query.project,
          global: route.query.global
        }
      })
    }

    const handleClose = () => {
      if (dagRef.value?.isCanvasDirty?.()) {
        const answer = window.confirm(
          t('project.synchronization_definition.leave_confirm')
        )
        if (!answer) return
      }
      isClosing.value = true
      doNavigateAway()
    }

    const handleLayout = (
      layoutType: 'grid' | 'dagre',
      cols: number,
      rows: number
    ) => {
      dagRef.value.layoutDag(layoutType, cols, rows)
    }

    onMounted(async () => {
      const result = await detailInit()
      if (result?.nodesAndEdges) {
        dagRef.value.addNodesAndEdges(
          result.nodesAndEdges.plugins,
          result.nodesAndEdges.edges
        )
      }
      document.documentElement.style.setProperty(
        '--node-config-hint',
        `"${t('dag.nodeConfigHint')}"`
      )
      window.addEventListener('beforeunload',handleBeforeUnload)
    })
    onBeforeUnmount(() => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    })

    watch(
      () => locale.value,
      () => {
        document.documentElement.style.setProperty(
          '--node-config-hint',
          `"${t('dag.nodeConfigHint')}"`
        )
      }
    )

    return () => (
       <div class="sync-definition-wrapper" style={{ backgroundColor: '#ffffff', borderRadius: '4px', paddingTop: '16px' }}>
      <NSpin show={state.loading}>
        <NSpace vertical>
        
          <DagToolbar
            onDelete={handleDelete}
            onSave={handleSave}
            onClose={handleClose}
            onLayout={handleLayout}
          />
          <div class={styles['workflow-dag']}>
            <DagSidebar onDragstart={handelDragstart} />
            <DagCanvas onDrop={handelDrop} ref={dagRef} />
          </div>
        </NSpace>
      </NSpin>
      </div>
    )
  }
})

export default SynchronizationDefinitionDag

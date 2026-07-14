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

import {
  defineComponent,
  ref,
  onMounted,
  reactive,
  provide,
  nextTick,
  onBeforeUnmount
} from 'vue'
import { Cell, Graph } from '@antv/x6'
import { useI18n } from 'vue-i18n'
import {
  DagEdgeName,
  DagNodeName,
  EdgeDefaultConfig,
  NodeWidth,
  NodeHeight
} from './dag-setting'
import { useDagNode } from './use-dag-node'
import { useDagResize } from './use-dag-resize'
import { useDagGraph } from './use-dag-graph'
import {
  addNode,
  formatLayout,
  initNodesAndEdges,
  updateNode
} from './dag-shape'
import NodeSetting from '../node-setting'
import { getDagData } from './dag-data'
import styles from './index.module.scss'
import type { Ref } from 'vue'
import type { InputEdge, InputPlugin, NodeInfo } from '../types'

const DagCanvas = defineComponent({
  name: 'DagCanvas',
  emits: ['drop'],
  setup(props, ctx) {
    const graph = ref<Graph>()
    provide('graph', graph)

    const container = ref()
    const dagContainer = ref()
    const minimapContainer = ref()
    const { t } = useI18n()
    const state = reactive({
      nodeInfo: {
        type: 'source',
        label: '',
        pluginId: '',
        transform: ''
      } as NodeInfo,
      show: false
    })

    let currentNodeId = ''
    let pendingViewportFit = false
    let pendingViewportFitForce = false
    let isInitialLoad = true
    const hasUnsavedChanges = ref(false)

    const handlePreventDefault = (e: DragEvent) => {
      e.preventDefault()
    }

    const handleDrop = (e: DragEvent) => {
      ctx.emit('drop', e)
    }

    const initGraph = () => {
      graph.value = useDagGraph(
        graph,
        dagContainer.value,
        minimapContainer.value
      )

      graph.value.on('cell:added', () => {
        if (isInitialLoad) return
        hasUnsavedChanges.value = true
      })
      graph.value.on('cell:removed', () => {
        if (isInitialLoad) return
        hasUnsavedChanges.value = true
      })
      graph.value.on('cell:change:*', () => {
        if (isInitialLoad) return
        hasUnsavedChanges.value = true
      })

      graph.value.on('render:done', () => {
        if (!pendingViewportFit) return
        const force = pendingViewportFitForce
        pendingViewportFit = false
        pendingViewportFitForce = false
        fitGraphViewport(force)
      })
    }

    const destroyGraph = () => {
      state.show = false
      if (!graph.value) return
      graph.value.unlockScroller()
      graph.value.dispose()
      graph.value = undefined
    }

    const fitGraphViewport = (force = false) => {
      if (!graph.value || !dagContainer.value || !graph.value.getNodes().length) {
        return
      }

      const viewportWidth = dagContainer.value.offsetWidth
      const viewportHeight = dagContainer.value.offsetHeight
      const contentBBox = graph.value.getContentBBox()
      const needsFit =
        force ||
        viewportWidth < 720 ||
        contentBBox.width > Math.max(viewportWidth - 48, 0) ||
        contentBBox.height > Math.max(viewportHeight - 48, 0)

      if (needsFit) {
        graph.value.zoomToFit({
          padding: 24,
          maxScale: 1
        })
      }

      graph.value.centerContent()
    }

    const requestViewportFit = (force = false) => {
      pendingViewportFit = true
      pendingViewportFitForce = pendingViewportFitForce || force

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!pendingViewportFit) return
          const nextForce = pendingViewportFitForce
          pendingViewportFit = false
          pendingViewportFitForce = false
          fitGraphViewport(nextForce)
        })
      })
    }

    const registerNode = () => {
      Graph.unregisterNode(DagNodeName)
      Graph.registerNode(DagNodeName, useDagNode())
    }

    const registerEdge = () => {
      Graph.unregisterEdge(DagEdgeName)
      Graph.registerEdge(DagEdgeName, EdgeDefaultConfig)
    }

    const onDoubleClick = () => {
      graph.value &&
        (graph.value as Graph).on(
          'cell:dblclick',
          ({ cell }: { cell: any }) => {
            if (cell.isEdge()) return
            let fields = [] as string[]
            const incomingEdges = graph.value?.getIncomingEdges(cell)
            if (incomingEdges?.length) {
              const sourceNode = incomingEdges[0].getSourceNode()
              const sourceData = sourceNode?.getData()
              fields = sourceData.selectTableFields?.tableFields || []
            }
            state.nodeInfo = {
              ...cell.getData(),
              type: cell.getData().type.toLowerCase(),
              sourceFields: fields,
              predecessorsNodeId: (graph.value?.getPredecessors(cell) as Cell[]).length > 0 ? graph.value?.getPredecessors(cell)[0].id : ''
            }
            currentNodeId = cell.id
            state.show = true
            graph.value!.lockScroller()
          }
        )
    }

    const onCancelModal = () => {
      state.show = false
      graph.value?.unlockScroller()
    }

    const onConfirmModal = (values: InputPlugin) => {
      state.show = false
      graph.value?.unlockScroller()
      const node = graph.value?.getCellById(currentNodeId)
      node?.replaceData({
        ...values,
        unsaved: false,
        isError: false,
        type: values.type.toLowerCase()
      })
      // Used to determine whether the current node has data saved.
      updateNode(graph.value as Graph)
    }

    useDagResize(container, graph as Ref<Graph>, () => {
      requestViewportFit()
    })

    ctx.expose({
      addNode: (cell: Cell.Metadata) => {
        const nextCell = { ...cell }

        if (
          typeof cell.clientX === 'number' &&
          typeof cell.clientY === 'number' &&
          graph.value
        ) {
          const localPoint = graph.value.clientToLocal(cell.clientX, cell.clientY)
          nextCell.x = localPoint.x - NodeWidth / 2
          nextCell.y = localPoint.y - NodeHeight / 2
        }

        addNode(graph.value as Graph, nextCell)
      },
      getGraph: () => graph.value,
      addNodesAndEdges: (cells: Cell.Metadata[], edges: InputEdge[]) => {
        initNodesAndEdges(graph.value as Graph, cells, edges)
        isInitialLoad = false
        nextTick(() => requestViewportFit(true))
      },
      getSelectedCells: () => graph.value?.getSelectedCells(),
      removeCell: (id: string) => graph.value?.removeCell(id),
      getDagData: () => getDagData(graph.value as Graph, t),
      layoutDag: (layoutType: 'grid' | 'dagre', cols: number, rows: number) => {
        formatLayout(graph.value, layoutType, cols, rows)
        nextTick(() => requestViewportFit(true))
      },
      isCanvasDirty: () => hasUnsavedChanges.value,
      markCanvasClean: () => {
        hasUnsavedChanges.value = false
      }
    })

    onMounted(() => {
      initGraph()
      registerNode()
      registerEdge()
      onDoubleClick()
    })

    onBeforeUnmount(() => {
      destroyGraph()
    })

    return () => (
      <div
        ref={container}
        class={styles.container}
        onDrop={handleDrop}
        onDragenter={handlePreventDefault}
        onDragover={handlePreventDefault}
        onDragleave={handlePreventDefault}
      >
        <div ref={dagContainer} class={styles['dag-container']} />
        <div ref={minimapContainer} class={styles.minimap} />
        {state.nodeInfo.type && (
          <NodeSetting
            show={state.show}
            nodeInfo={state.nodeInfo}
            onCancelModal={onCancelModal}
            onConfirmModal={onConfirmModal}
          />
        )}
      </div>
    )
  }
})

export { DagCanvas }

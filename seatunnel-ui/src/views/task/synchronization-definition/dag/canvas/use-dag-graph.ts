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

import { Graph, Edge } from '@antv/x6'
import { DagEdgeName } from './dag-setting'

export function useDagGraph(
  graph: any,
  dagContainer: HTMLElement,
  minimapContainer: HTMLElement
) {
  const graphInstance = new Graph({
    container: dagContainer,
    scroller: {
      enabled: true,
      pannable: true,
      autoResize: true,
      autoResizeOptions: {
        padding: {
          top: 80,
          right: 80,
          bottom: 80,
          left: 80
        }
      }
    },
    grid: {
      size: 10,
      visible: true
    },
    mousewheel: {
      enabled: true,
      modifiers: ['ctrl', 'meta'],
      minScale: 0.4,
      maxScale: 2.5,
      factor: 1.1
    },
    connecting: {
      router: {
        name: 'manhattan',
        args: {
          padding: 20,
          startDirections: ['right'],
          endDirections: ['left']
        }
      },
      connector: {
        name: 'rounded',
        args: {
          radius: 8
        }
      },
      allowBlank: false,
      allowLoop: false,
      allowNode: false,
      snap: {
        radius: 20
      },
      createEdge() {
        return graph.value?.createEdge({ shape: DagEdgeName })
      },
      validateConnection(data) {
        const { sourceCell, targetCell } = data
        if (targetCell?.getData().type === 'source') return false
        if (targetCell?.getData().type === 'sink') {
          return graph.value?.getConnectedEdges(targetCell).length < 1
        }
        
        if (targetCell?.getData().type === 'transform') {
          // The same 'Copy' transform node cannot be connected
          const srcData = sourceCell?.getData(), tgtData = targetCell?.getData()
          if (srcData.type === 'transform' && srcData.connectorType === 'Copy' && tgtData.connectorType === 'Copy') return false

          // don't connect self
          const edges = graph.value?.getConnectedEdges(targetCell)
          return !edges.some((edge: Edge) => {
            return edge.getTargetCellId() === targetCell.id
          })
        }

        return true
      }
    },
    snapline: {
      enabled: true,
      sharp: true
    },
    minimap: {
      enabled: true,
      width: 200,
      height: 120,
      padding: 8,
      container: minimapContainer
    },
    selecting: {
      enabled: true,
      rubberband: false,
      movable: true,
      showNodeSelectionBox: true,
      showEdgeSelectionBox: true
    },
    highlighting: {
      magnetAdsorbed: {
        name: 'stroke',
        args: {
          attrs: {
            fill: '#5F95FF',
            stroke: '#5F95FF'
          }
        }
      }
    },
    interacting: {
      nodeMovable: true,
      edgeMovable: false,
      edgeLabelMovable: false,
      arrowheadMovable: false,
      vertexMovable: false,
      vertexAddable: false,
      vertexDeletable: false
    }
  })
  
  // 连线高亮交互
  graphInstance.on('edge:mouseenter', ({ edge }) => {
    edge.attr('line/strokeWidth', 3)
    edge.attr('line/stroke', '#5F95FF')
    edge.setZIndex(1000)
  })
  
  graphInstance.on('edge:mouseleave', ({ edge }) => {
    edge.attr('line/strokeWidth', 2)
    edge.attr('line/stroke', '#A2B1C3')
    edge.setZIndex(0)
  })
  
  // 节点连接点高亮
  graphInstance.on('node:mouseenter', ({ node }) => {
    const ports = dagContainer.querySelectorAll('.x6-port-body')
    ports.forEach((port) => {
      port.classList.add('port-highlight')
    })
  })
  
  graphInstance.on('node:mouseleave', ({ node }) => {
    const ports = dagContainer.querySelectorAll('.x6-port-body')
    ports.forEach((port) => {
      port.classList.remove('port-highlight')
    })
  })
  
  return graphInstance
}

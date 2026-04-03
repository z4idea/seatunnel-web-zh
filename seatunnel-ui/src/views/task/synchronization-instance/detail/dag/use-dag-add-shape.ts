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

import { DagEdgeName, DagNodeName } from './dag-setting'
import { getSyncTaskStatusMeta } from '../../status-display'

const stateColor = {
  failed: {
    fill: '#ffced7',
    stroke: '#ffa8b7'
  },
  running: {
    fill: '#ceebff',
    stroke: '#b0deff'
  },
  finished: {
    fill: '#ceffee',
    stroke: '#a8ffe0'
  },
  canceled: {
    fill: '#d5d5d5',
    stroke: '#b6b6b6'
  }
}

const defaultStateColor = {
  fill: '#eef2f7',
  stroke: '#d7dee8'
}

const childNodeTheme = {
  source: {
    fill: '#ecfdf5',
    stroke: '#34d399',
    text: '#065f46'
  },
  sink: {
    fill: '#eff6ff',
    stroke: '#60a5fa',
    text: '#1e3a8a'
  },
  transform: {
    fill: '#f5f3ff',
    stroke: '#a78bfa',
    text: '#5b21b6'
  }
}

export function useDagAddShape(
  graph: any,
  nodes: any,
  edges: Array<any>,
  t: any
) {
  for (const i in nodes) {
    const normalizedStatus = String(nodes[i].status || '')
      .toLowerCase() as keyof typeof stateColor
    const currentStateColor = stateColor[normalizedStatus] || defaultStateColor

    const group = graph.addNode({
      x: 40,
      y: 40,
      width: 360,
      height: 160,
      zIndex: 1,
      attrs: {
        body: currentStateColor
      }
    })

    group.addTools({
      name: 'button',
      args: {
        markup: [
          {
            tagName: 'text',
            textContent: `pipeline#${nodes[i].pipelineId}`,
            attrs: {
              fill: '#333333',
              'font-size': 14,
              'text-anchor': 'center',
              stroke: 'black'
            }
          },
          {
            tagName: 'text',
            textContent: `${t('project.synchronization_instance.state')}: ${
              getSyncTaskStatusMeta(nodes[i].status, t).label
            }`,
            attrs: {
              fill: '#868686',
              'font-size': 12,
              'text-anchor': 'start',
              x: '7em'
            }
          },
          {
            tagName: 'text',
            textContent: `${t('project.synchronization_instance.read')} ${
              nodes[i].readRowCount
            }${t('project.synchronization_instance.line')}/${t(
              'project.synchronization_instance.write'
            )} ${nodes[i].writeRowCount}${t(
              'project.synchronization_instance.line'
            )}`,
            attrs: {
              fill: '#868686',
              'font-size': 12,
              'text-anchor': 'start',
              x: '20em'
            }
          }
        ],
        x: 0,
        y: 0,
        offset: { x: 0, y: -18 }
      }
    })

    nodes[i].child.forEach((n: any) => {

      const nodeType = (n.nodeType && n.nodeType.toLowerCase()) || 
        (n.label.toLowerCase().includes('source') ? 'source' : 
         n.label.toLowerCase().includes('sink') ? 'sink' : 'transform');
      

      const portItems = [];
      const nodeTheme =
        childNodeTheme[nodeType as keyof typeof childNodeTheme] ||
        childNodeTheme.transform

      
      group.addChild(
        graph.addNode({
          id: n.id,
          x: 50,
          y: 50,
          width: 180,
          height: 44,
          shape: 'rect',
          zIndex: 10,
          attrs: {
            body: {
              fill: nodeTheme.fill,
              stroke: nodeTheme.stroke,
              strokeWidth: 1.5,
              rx: 8,
              ry: 8
            },
            label: {
              text: n.label,
              fill: nodeTheme.text,
              fontSize: 13,
              fontWeight: 600,
              textWrap: {
                width: -24,
                height: -12,
                ellipsis: true
              }
            }
          },
          ports: {
            items: portItems
          },
          data: {
            name: n.label,
            nodeType: nodeType,
            connectorType: n.label,
            status: 'idle',
            vertexId: n.vertexId
          }
        })
      )
    })
  }

  edges.forEach((e: any) => {
    graph.addEdge({
      shape: DagEdgeName,
      source: {
        cell: e.source,
        port: 'output'
      },
      target: {
        cell: e.target,
        port: 'input'
      },
      id: e.id,
      zIndex: 5,
      data: {
        animated: true
      }
    })
  })
}

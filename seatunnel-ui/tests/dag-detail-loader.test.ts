/*
 * @author: zhjj
 */

import { loadDagDetailData } from '../src/views/task/synchronization-definition/dag/dag-detail-loader'

describe('loadDagDetailData', () => {
  it('keeps dag nodes when source validation fails', async () => {
    const nodesAndEdges = {
      plugins: [
        {
          pluginId: 'source-1',
          type: 'SOURCE',
          name: 'source-node',
          dataSourceId: 1,
          tableOption: {
            databases: ['db_a'],
            tables: ['table_a']
          }
        },
        {
          pluginId: 'sink-1',
          type: 'SINK',
          name: 'sink-node'
        }
      ],
      edges: [
        {
          inputPluginId: 'source-1',
          targetPluginId: 'sink-1'
        }
      ]
    }

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const setDagInfo = vi.fn()

    const result = await loadDagDetailData({
      jobDefinitionCode: '926',
      t: (key) => key,
      message: { warning: vi.fn() },
      setDagInfo,
      services: {
        getDefinitionNodesAndEdges: vi.fn().mockResolvedValue(nodesAndEdges),
        getDefinitionConfig: vi.fn().mockResolvedValue({ name: 'job-name' }),
        getDefinitionDetail: vi.fn().mockResolvedValue({ description: 'job-desc' }),
        checkDatabaseAndTable: vi.fn().mockRejectedValue(new Error('timeout'))
      }
    })

    expect(result.nodesAndEdges).toEqual(nodesAndEdges)
    expect(setDagInfo).toHaveBeenCalledWith({
      name: 'job-name',
      description: 'job-desc'
    })
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('removes invalid databases and tables from validated source nodes', async () => {
    const nodesAndEdges = {
      plugins: [
        {
          pluginId: 'source-1',
          type: 'SOURCE',
          name: 'source-node',
          dataSourceId: 1,
          tableOption: {
            databases: ['db_a', 'db_b'],
            tables: ['table_a', 'table_b']
          }
        }
      ],
      edges: []
    }

    const result = await loadDagDetailData({
      jobDefinitionCode: '926',
      t: (key) => key,
      message: { warning: vi.fn() },
      setDagInfo: vi.fn(),
      services: {
        getDefinitionNodesAndEdges: vi.fn().mockResolvedValue(nodesAndEdges),
        getDefinitionConfig: vi.fn().mockResolvedValue({}),
        getDefinitionDetail: vi.fn().mockResolvedValue({}),
        checkDatabaseAndTable: vi.fn().mockResolvedValue({
          databases: ['db_b'],
          tables: ['table_b']
        })
      }
    })

    expect(result.nodesAndEdges.plugins[0].tableOption).toEqual({
      databases: ['db_a'],
      tables: ['table_a']
    })
  })
})

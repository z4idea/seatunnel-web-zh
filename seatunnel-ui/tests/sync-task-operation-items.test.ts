/*
 * @author: zhjj
 */

import {
  buildSyncTaskInstanceDetailRoute,
  getSyncTaskOperationItems
} from '../src/views/task/synchronization-instance/operation-items'

describe('sync task operation items', () => {
  it('includes a detail action that reuses the instance detail route', () => {
    const row = {
      id: 321,
      jobDefineId: 123,
      jobDefineName: 'daily collect',
      jobStatus: 'RUNNING'
    }
    const t = (key: string) => key

    expect(buildSyncTaskInstanceDetailRoute(row)).toEqual({
      path: '/task/synchronization-instance/123',
      query: {
        jobInstanceId: 321,
        taskName: 'daily collect'
      }
    })

    expect(getSyncTaskOperationItems(row, t)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'detail',
          label: 'project.detail'
        })
      ])
    )
  })
})

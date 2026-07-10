/*
 * @author: zhjj
 */

import { createTaskDetailTrigger } from '../src/views/task/synchronization-definition/task-detail-trigger'

describe('createTaskDetailTrigger', () => {
  it('uses the task name as label and opens detail with the clicked row', () => {
    const row = {
      id: 101,
      name: 'test task'
    }
    const openDetail = vi.fn()

    const trigger = createTaskDetailTrigger(row, openDetail)

    expect(trigger.label).toBe('test task')
    trigger.onClick()
    expect(openDetail).toHaveBeenCalledWith(row)
  })
})

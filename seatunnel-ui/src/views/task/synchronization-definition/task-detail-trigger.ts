/*
 * @author: zhjj
 */

type TaskDefinitionRow = Record<string, any>

type TaskDetailTrigger = {
  label: string
  onClick: () => void
}

export const createTaskDetailTrigger = (
  row: TaskDefinitionRow,
  openDetail: (row: TaskDefinitionRow) => void
): TaskDetailTrigger => ({
  label: row?.name || '-',
  onClick: () => openDetail(row)
})


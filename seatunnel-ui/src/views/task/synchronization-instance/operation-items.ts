/*
 * @author: zhjj
 */

type TranslateFn = (key: string) => string

type SyncTaskInstanceRow = {
  id: number | string
  jobDefineId: number | string
  jobDefineName?: string
  jobStatus?: string
}

type SyncTaskOperationItem = {
  key: 'detail' | 'recover' | 'pause' | 'logs' | 'delete'
  label: string
  enabled: boolean
}

const runningJobStatuses = new Set(['RUNNING', 'EXECUTING'])
const recoverableJobStatuses = new Set(['PAUSED', 'PAUSE'])

const normalizeJobStatus = (jobStatus?: string) =>
  String(jobStatus || '').trim().toUpperCase()

export const buildSyncTaskInstanceDetailRoute = (row: SyncTaskInstanceRow) => ({
  path: `/task/synchronization-instance/${row.jobDefineId}`,
  query: {
    jobInstanceId: row.id,
    taskName: row.jobDefineName
  }
})

export const getSyncTaskOperationItems = (
  row: SyncTaskInstanceRow,
  t: TranslateFn
): SyncTaskOperationItem[] => [
  {
    key: 'detail',
    label: t('project.detail'),
    enabled: true
  },
  {
    key: 'recover',
    label: t('project.workflow.recovery_suspend'),
    enabled: recoverableJobStatuses.has(normalizeJobStatus(row.jobStatus))
  },
  {
    key: 'pause',
    label: t('project.workflow.pause'),
    enabled: runningJobStatuses.has(normalizeJobStatus(row.jobStatus))
  },
  {
    key: 'logs',
    label: t('project.synchronization_instance.view_logs'),
    enabled: true
  },
  {
    key: 'delete',
    label: t('project.synchronization_instance.delete'),
    enabled: true
  }
]


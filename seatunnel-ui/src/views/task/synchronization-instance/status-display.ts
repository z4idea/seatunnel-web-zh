/* @author: zhjj */
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

import { h } from 'vue'
import { NTag } from 'naive-ui'

type Translate = (key: string) => string

type SyncTaskStatusMeta = {
  label: string
  tagType: 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'
}

const syncTaskStatusOrder = [
  'RUNNING',
  'FINISHED',
  'FAILED',
  'CANCELED',
  'PAUSED',
  'STOPPED',
  'KILLED',
  'SUBMITTED',
  'PENDING',
  'SCHEDULED',
  'INITIALIZING',
  'EXECUTING',
  'FAILING',
  'DOING_SAVEPOINT',
  'SAVEPOINT_DONE',
  'SUSPENDED',
  'CREATED',
  'ERROR'
] as const

const syncTaskStatusAliases: Record<string, string> = {
  SUCCESS: 'FINISHED',
  COMPLETED: 'FINISHED',
  FAILURE: 'FAILED',
  RUNNING_EXECUTION: 'RUNNING',
  PAUSE: 'PAUSED',
  STOP: 'STOPPED',
  KILL: 'KILLED',
  CANCELLED: 'CANCELED'
}

const statusTagTypeMap: Record<string, SyncTaskStatusMeta['tagType']> = {
  SUBMITTED_SUCCESS: 'info',
  RUNNING_EXECUTION: 'primary',
  READY_PAUSE: 'warning',
  PAUSE: 'warning',
  READY_STOP: 'warning',
  STOP: 'default',
  FAILURE: 'error',
  SUCCESS: 'success',
  NEED_FAULT_TOLERANCE: 'warning',
  KILL: 'error',
  WAITING_THREAD: 'info',
  WAITING_DEPEND: 'info',
  DELAY_EXECUTION: 'info',
  FORCED_SUCCESS: 'success',
  SERIAL_WAIT: 'primary',
  READY_BLOCK: 'warning',
  BLOCK: 'warning',
  DISPATCH: 'info',
  PAUSE_BY_ISOLATION: 'warning',
  KILL_BY_ISOLATION: 'error',
  PAUSE_BY_CORONATION: 'warning',
  FORBIDDEN_BY_CORONATION: 'default',
  CREATED: 'default',
  SUBMITTED: 'info',
  PENDING: 'warning',
  SCHEDULED: 'info',
  INITIALIZING: 'info',
  RUNNING: 'primary',
  EXECUTING: 'primary',
  FAILING: 'warning',
  DOING_SAVEPOINT: 'warning',
  SAVEPOINT_DONE: 'success',
  FINISHED: 'success',
  COMPLETED: 'success',
  FAILED: 'error',
  ERROR: 'error',
  CANCELED: 'default',
  PAUSED: 'warning',
  SUSPENDED: 'warning',
  STOPPED: 'default',
  KILLED: 'error',
  UNKNOWABLE: 'default'
}

const statusLocaleKeyMap: Record<string, string> = {
  SUBMITTED_SUCCESS: 'project.workflow.submit_success',
  RUNNING_EXECUTION: 'project.workflow.executing',
  READY_PAUSE: 'project.workflow.ready_to_pause',
  PAUSE: 'project.workflow.pause',
  READY_STOP: 'project.workflow.ready_to_stop',
  STOP: 'project.workflow.stop',
  FAILURE: 'project.workflow.failed',
  SUCCESS: 'project.workflow.success',
  NEED_FAULT_TOLERANCE: 'project.workflow.need_fault_tolerance',
  KILL: 'project.workflow.kill',
  WAITING_THREAD: 'project.workflow.waiting_for_thread',
  WAITING_DEPEND: 'project.workflow.waiting_for_dependence',
  DELAY_EXECUTION: 'project.workflow.delay_execution',
  FORCED_SUCCESS: 'project.workflow.forced_success',
  SERIAL_WAIT: 'project.workflow.serial_wait',
  READY_BLOCK: 'project.overview.ready_block',
  BLOCK: 'project.overview.block',
  DISPATCH: 'project.workflow.dispatch',
  PAUSE_BY_ISOLATION: 'project.overview.pause_by_isolation',
  KILL_BY_ISOLATION: 'project.overview.kill_by_isolation',
  PAUSE_BY_CORONATION: 'project.overview.pause_by_coronation',
  FORBIDDEN_BY_CORONATION: 'project.overview.forbidden_by_coronation',
  CREATED: 'project.synchronization_instance.status_created',
  SUBMITTED: 'project.synchronization_instance.status_submitted',
  PENDING: 'project.synchronization_instance.status_pending',
  SCHEDULED: 'project.synchronization_instance.status_scheduled',
  INITIALIZING: 'project.synchronization_instance.status_initializing',
  RUNNING: 'project.synchronization_instance.status_running',
  EXECUTING: 'project.synchronization_instance.status_executing',
  FAILING: 'project.synchronization_instance.status_failing',
  DOING_SAVEPOINT: 'project.synchronization_instance.status_doing_savepoint',
  SAVEPOINT_DONE: 'project.synchronization_instance.status_savepoint_done',
  FINISHED: 'project.synchronization_instance.status_finished',
  COMPLETED: 'project.synchronization_instance.status_completed',
  FAILED: 'project.synchronization_instance.status_failed',
  ERROR: 'project.synchronization_instance.status_error',
  CANCELED: 'project.synchronization_instance.status_canceled',
  PAUSED: 'project.synchronization_instance.status_paused',
  SUSPENDED: 'project.synchronization_instance.status_suspended',
  STOPPED: 'project.synchronization_instance.status_stopped',
  KILLED: 'project.synchronization_instance.status_killed',
  UNKNOWABLE: 'project.synchronization_instance.status_unknowable'
}

const normalizeStatus = (status?: string) => {
  return String(status || 'UNKNOWABLE').trim().toUpperCase()
}

export const normalizeSyncTaskStatusValue = (status?: string | null) => {
  const normalizedStatus = normalizeStatus(status || undefined)
  return syncTaskStatusAliases[normalizedStatus] || normalizedStatus
}

export const isSyncTaskFailureStatus = (status?: string | null) => {
  const normalizedStatus = normalizeSyncTaskStatusValue(status)
  return (
    normalizedStatus === 'FAILED' ||
    normalizedStatus === 'KILLED' ||
    normalizedStatus === 'CANCELED' ||
    normalizedStatus === 'STOPPED'
  )
}

export const isSyncTaskSuccessStatus = (status?: string | null) => {
  const normalizedStatus = normalizeSyncTaskStatusValue(status)
  return normalizedStatus === 'FINISHED'
}

export const normalizeSyncTaskStatusFilterValue = (status?: string | null) => {
  if (status == null || String(status).trim() === '') {
    return null
  }

  return normalizeSyncTaskStatusValue(status)
}

export const getSyncTaskStatusOptions = (t: Translate) =>
  syncTaskStatusOrder.map((status) => ({
    label: getSyncTaskStatusMeta(status, t).label,
    value: status
  }))

export const getSyncTaskStatusMeta = (
  status: string,
  t?: Translate
): SyncTaskStatusMeta => {
  const normalizedStatus = normalizeStatus(status)
  const localeKey = statusLocaleKeyMap[normalizedStatus]
  const translatedLabel =
    t && localeKey ? t(localeKey) : normalizedStatus
  const label =
    translatedLabel && translatedLabel !== localeKey
      ? translatedLabel
      : normalizedStatus

  return {
    label,
    tagType: statusTagTypeMap[normalizedStatus] || 'default'
  }
}

export const renderSyncTaskStatusTag = (status: string, t?: Translate) => {
  const meta = getSyncTaskStatusMeta(status, t)

  return h(
    NTag,
    {
      type: meta.tagType,
      bordered: false,
      size: 'small'
    },
    {
      default: () => meta.label
    }
  )
}

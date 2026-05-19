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

const statusTagTypeMap: Record<string, SyncTaskStatusMeta['tagType']> = {
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
  SUCCESS: 'success',
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
  SUCCESS: 'project.synchronization_instance.status_success',
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

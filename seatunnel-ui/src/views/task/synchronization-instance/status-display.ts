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

const normalizeStatus = (status?: string) => {
  return String(status || 'UNKNOWABLE').trim().toUpperCase()
}

export const getSyncTaskStatusMeta = (
  status: string,
  t?: Translate
): SyncTaskStatusMeta => {
  const normalizedStatus = normalizeStatus(status)
  const localeKey = `project.synchronization_definition.status_${normalizedStatus.toLowerCase()}`

  return {
    label: t ? t(localeKey) : normalizedStatus,
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

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

import { axios } from '@/service/service'
import rawAxios from 'axios'
import { useUserStore } from '@/store/user'
import type { LogParams, LogRes } from './types'

function getLogRequestHeaders(): Record<string, string> {
  const userStore = useUserStore()
  const token = (userStore.getUserInfo as { token?: string }).token

  return token ? { token } : {}
}

// Query task logs
export function queryLog(params: LogParams): Promise<LogRes> {
  return axios({
    url: '/log/detail',
    method: 'get',
    params
  })
}

// Get log node list
export function getLogNodes(jobId: string | number): Promise<any> {
  // Here we use raw axios to make direct requests, avoiding the addition of /seatunnel/api/v1 prefix
  return rawAxios.get(`/api/logs/${jobId}`, {
    params: { format: 'json' },
    headers: getLogRequestHeaders()
  })
}

// Get log content
export function getLogContent(logUrl: string): Promise<{ data: string }> {
  if (!logUrl) {
    return Promise.reject(new Error('Log URL is required'))
  }

  // Proxy absolute engine URLs through the local /api route in development.
  if (logUrl.startsWith('http')) {
    try {
      const url = new URL(logUrl)
      const pathName = url.pathname
      const search = url.search

      return rawAxios.get(`/api${pathName}${search}`, {
        headers: getLogRequestHeaders()
      })
    } catch (e) {
      return Promise.reject(new Error('Failed to fetch log content'))
    }
  }

  if (logUrl.startsWith('/logs/')) {
    return rawAxios.get(`/api${logUrl}`, {
      headers: getLogRequestHeaders()
    })
  }

  if (logUrl.startsWith('logs/')) {
    return rawAxios.get(`/api/${logUrl}`, {
      headers: getLogRequestHeaders()
    })
  }

  const [rawFileName] = logUrl.split('?')
  const logFileName = rawFileName.split('/').pop() || ''

  return rawAxios.get(`/api/logs/${encodeURIComponent(logFileName)}`, {
    headers: getLogRequestHeaders()
  })
}

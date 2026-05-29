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

import axios from 'axios'
import { axios as apiAxios } from '@/service/service'
import {
  attachSilentAuthRequestRenewal,
  attachSilentAuthResponseRetry
} from '@/service/silent-auth-retry'
import { getStoredToken } from '@/utils/auto-login'
import type { LogParams, LogRes } from './types'

const logAxios = axios.create()

attachSilentAuthResponseRetry(logAxios)
logAxios.interceptors.request.use(
  attachSilentAuthRequestRenewal((config) => {
    const token = getStoredToken()
    if (token) {
      config.headers = config.headers || {}
      config.headers.token = token
    }
    return config
  })
)

// Query task logs
export function queryLog(params: LogParams): Promise<LogRes> {
  return apiAxios({
    url: '/log/detail',
    method: 'get',
    params
  })
}

// Get log node list
export function getLogNodes(jobId: string | number): Promise<any> {
  return logAxios.get(`/api/logs/${jobId}`, {
    params: { format: 'json' }
  })
}

// Get log content
export function getLogContent(logUrl: string): Promise<{ data: string }> {
  if (!logUrl) {
    return Promise.reject(new Error('Log URL is required'))
  }

  if (logUrl.startsWith('http')) {
    try {
      const url = new URL(logUrl)
      const pathName = url.pathname
      const search = url.search

      return logAxios.get(`/api${pathName}${search}`)
    } catch (e) {
      return Promise.reject(new Error('Failed to fetch log content'))
    }
  }

  if (logUrl.startsWith('/logs/')) {
    return logAxios.get(`/api${logUrl}`)
  }

  if (logUrl.startsWith('logs/')) {
    return logAxios.get(`/api/${logUrl}`)
  }

  const [rawFileName] = logUrl.split('?')
  const logFileName = rawFileName.split('/').pop() || ''

  return logAxios.get(`/api/logs/${encodeURIComponent(logFileName)}`)
}

/*
 * @author: zhjj
 *
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

import type {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig
} from 'axios'
import { useUserStore } from '@/store/user'
import {
  ensureDefaultAutoLogin,
  getStoredToken,
  isManualLogout,
  isTokenIllegalPayload,
  renewDefaultTokenIfExpired,
  shouldSkipSilentAuthForUrl
} from '@/utils/auto-login'

export type SilentAuthRetryConfig = InternalAxiosRequestConfig & {
  _silentAuthRetry?: boolean
}

function applyTokenHeader(config: SilentAuthRetryConfig) {
  const token = getStoredToken()
  if (!token) {
    return
  }
  config.headers = config.headers || {}
  config.headers.token = token
}

export async function redirectToLoginPage() {
  useUserStore().setUserInfo({})
  const { default: router } = await import('@/router')
  await router.push({ path: '/login' })
}

function canSilentAuthRetry(config?: SilentAuthRetryConfig): boolean {
  if (!config || config._silentAuthRetry) {
    return false
  }
  if (isManualLogout()) {
    return false
  }
  return !shouldSkipSilentAuthForUrl(config.url)
}

async function silentReLogin(): Promise<boolean> {
  return ensureDefaultAutoLogin(true)
}

export async function trySilentAuthRetry(
  axiosInstance: AxiosInstance,
  config: SilentAuthRetryConfig
): Promise<AxiosResponse | null> {
  if (!canSilentAuthRetry(config)) {
    return null
  }

  config._silentAuthRetry = true
  const ok = await silentReLogin()
  if (!ok) {
    redirectToLoginPage()
    return null
  }

  applyTokenHeader(config)
  return axiosInstance.request(config)
}

export function attachSilentAuthRequestRenewal(
  onBeforeRequest: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>
) {
  return async (config: InternalAxiosRequestConfig) => {
    const nextConfig = await onBeforeRequest(config)
    if (
      !isManualLogout() &&
      !shouldSkipSilentAuthForUrl(nextConfig.url) &&
      !(nextConfig as SilentAuthRetryConfig)._silentAuthRetry
    ) {
      await renewDefaultTokenIfExpired()
      const token = getStoredToken()
      if (token) {
        nextConfig.headers = nextConfig.headers || {}
        ;(nextConfig.headers as Record<string, string>).token = token
      }
    }
    return nextConfig
  }
}

export function attachSilentAuthResponseRetry(axiosInstance: AxiosInstance) {
  axiosInstance.interceptors.response.use(
    async (response: AxiosResponse) => {
      if (!isTokenIllegalPayload(response.data)) {
        return response
      }

      const config = response.config as SilentAuthRetryConfig
      const retried = await trySilentAuthRetry(axiosInstance, config)
      if (retried) {
        return retried
      }
      if (isManualLogout() || config._silentAuthRetry) {
        redirectToLoginPage()
      }
      return response
    },
    async (error: AxiosError) => {
      const config = error.config as SilentAuthRetryConfig | undefined

      if (error.response?.status === 401) {
        if (isManualLogout()) {
          redirectToLoginPage()
          return Promise.reject(error)
        }
        if (config) {
          const retried = await trySilentAuthRetry(axiosInstance, config)
          if (retried) {
            return retried
          }
        }
      }

      return Promise.reject(error)
    }
  )
}

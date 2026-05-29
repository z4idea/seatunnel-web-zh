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

import axios from 'axios'
import { useUserStore } from '@/store/user'
import type { UserDetail } from '@/service/user/types'

export const AUTO_LOGIN_MANUAL_LOGOUT_KEY = 'seatunnel_manual_logout'

export const DEFAULT_AUTO_LOGIN = {
  username: 'admin',
  password: 'admin',
  workspace: 'default'
} as const

let autoLoginPromise: Promise<boolean> | null = null

export function isManualLogout(): boolean {
  return sessionStorage.getItem(AUTO_LOGIN_MANUAL_LOGOUT_KEY) === '1'
}

export function markManualLogout(): void {
  sessionStorage.setItem(AUTO_LOGIN_MANUAL_LOGOUT_KEY, '1')
}

export function clearManualLogout(): void {
  sessionStorage.removeItem(AUTO_LOGIN_MANUAL_LOGOUT_KEY)
}

export const TOKEN_ILLEGAL_CODE = 10008

const AUTH_SKIP_URLS = ['/user/login', '/user/logout']

export function isUserLoggedIn(): boolean {
  const userStore = useUserStore()
  const info = userStore.getUserInfo as UserDetail
  return Boolean(info?.token)
}

export function getStoredToken(): string | undefined {
  const userStore = useUserStore()
  return (userStore.getUserInfo as UserDetail)?.token
}

export function isJwtExpired(token: string, skewSeconds = 30): boolean {
  try {
    const payloadPart = token.split('.')[1]
    if (!payloadPart) {
      return false
    }
    const payload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')))
    const exp = payload.exp
    if (typeof exp !== 'number') {
      return false
    }
    return Date.now() >= exp * 1000 - skewSeconds * 1000
  } catch {
    return false
  }
}

export function shouldSkipSilentAuthForUrl(url?: string): boolean {
  if (!url) {
    return false
  }
  return AUTH_SKIP_URLS.some((path) => url.includes(path))
}

export function isTokenIllegalPayload(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { code?: number }).code === TOKEN_ILLEGAL_CODE
  )
}

export async function ensureDefaultAutoLogin(force = false): Promise<boolean> {
  if (isManualLogout()) {
    return false
  }
  const token = getStoredToken()
  if (!force && token && !isJwtExpired(token)) {
    return true
  }
  if (autoLoginPromise) {
    return autoLoginPromise
  }

  autoLoginPromise = (async () => {
    try {
      const userStore = useUserStore()
      const { data } = await axios.post(
        '/seatunnel/api/v1/user/login',
        {
          username: DEFAULT_AUTO_LOGIN.username,
          password: DEFAULT_AUTO_LOGIN.password,
          workspace: DEFAULT_AUTO_LOGIN.workspace
        },
        { timeout: 6000 }
      )
      if (!data?.success || !data?.data) {
        return false
      }
      userStore.setUserInfo(data.data as UserDetail)
      return true
    } catch {
      return false
    }
  })()

  try {
    return await autoLoginPromise
  } finally {
    autoLoginPromise = null
  }
}

/** Renew default credentials before requests when JWT is expired. */
export async function renewDefaultTokenIfExpired(): Promise<boolean> {
  if (isManualLogout()) {
    return false
  }
  const token = getStoredToken()
  if (!token) {
    return ensureDefaultAutoLogin()
  }
  if (!isJwtExpired(token)) {
    return true
  }
  return ensureDefaultAutoLogin(true)
}

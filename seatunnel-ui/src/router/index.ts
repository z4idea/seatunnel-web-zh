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

import { createRouter, createWebHashHistory } from 'vue-router'
import routes from './routes'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import {
  ensureDefaultAutoLogin,
  getStoredToken,
  isJwtExpired,
  isManualLogout,
  isUserLoggedIn,
  renewDefaultTokenIfExpired
} from '@/utils/auto-login'

const router = createRouter({
  history: createWebHashHistory(
      import.meta.env.MODE === 'production' ? '/ui/' : '/'
  ),
  routes
})

router.beforeEach(async (to, _from, next) => {
  try {
    const token = getStoredToken()
    if (token && isJwtExpired(token) && !isManualLogout()) {
      await renewDefaultTokenIfExpired()
    }

    if (isUserLoggedIn()) {
      if (to.name === 'login') {
        next({ path: '/tasks' })
        return
      }
      next()
      return
    }

    if (isManualLogout()) {
      next()
      return
    }

    const loggedIn = await ensureDefaultAutoLogin()
    if (loggedIn && (to.name === 'login' || to.path === '/')) {
      next({ path: '/tasks' })
      return
    }

    next()
  } catch (error) {
    console.error('Route auth guard failed:', error)
    next()
  }
})

router.afterEach(() => {
  NProgress.done()
})

export default router
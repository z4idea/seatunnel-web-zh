/*
 * @author: zhjj
 */
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

import { defineComponent, watch, ref } from 'vue'
import { useRoute } from 'vue-router'
import { NLayout, NLayoutHeader, NLayoutContent, NSpace } from 'naive-ui'
import Header from './header'
import Sidebar from './sidebar'
import { usePersistentErrorMessage } from '@/utils/message'

const Dashboard = defineComponent({
  setup() {
    window.$message = usePersistentErrorMessage()
    const route = useRoute()
    const showSide = ref(false)
    const showHeader = ref(true)
    const embeddedRoutePrefixes = [
      '/task/',
      '/datasource/',
      '/virtual-tables/',
      '/user-manage/'
    ]

    const menuKey = ref(route.meta.activeMenu as string)

    watch(
      () => route,
      () => {
        const isDefaultEmbeddedView =
          embeddedRoutePrefixes.some((prefix) =>
            route.path.startsWith(prefix)
          ) && !route.path.startsWith('/dev/')
        showHeader.value = !isDefaultEmbeddedView
        showSide.value =
          !isDefaultEmbeddedView && (route?.meta?.showSide as boolean)
        menuKey.value = route.meta.activeSide as string
      },
      {
        immediate: true,
        deep: true
      }
    )
    return {
      showHeader,
      showSide,
      menuKey
    }
  },
  render() {
    return (
      <NLayout>
        {this.showHeader && (
          <NLayoutHeader bordered>
            <Header />
          </NLayoutHeader>
        )}
        <NLayoutContent
          style={{
            height: this.showHeader ? 'calc(100vh - 65px)' : '100vh'
          }}
        >
          <NLayout has-sider position='absolute'>
            {this.showSide && <Sidebar sideKey={this.menuKey} />}
            <NLayoutContent
              native-scrollbar={false}
              style='padding: 16px 22px 0px 22px'
              class='p-16-22-0-22'
              contentStyle={'height: 100%'}
            >
              <NSpace
                vertical
                justify='space-between'
                style={'height: 100%'}
                size='small'
              >
                <router-view
                  key={this['$route'].fullPath}
                  class={!this.showSide && 'px-32 py-12'}
                />
              </NSpace>
            </NLayoutContent>
          </NLayout>
        </NLayoutContent>
      </NLayout>
    )
  }
})

export default Dashboard

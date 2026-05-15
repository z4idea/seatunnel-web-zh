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

import { defineComponent, ref } from 'vue'
import { NLayoutSider, NMenu } from 'naive-ui'
import { useThemeStore } from '@/store/theme'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const Sidebar = defineComponent({
  name: 'Sidebar',
  props: ['sideKey'],
  setup() {
    const router = useRouter()
    const collapsedRef = ref(false)
    const defaultExpandedKeys = ['']
    const { t } = useI18n()
    const themeStore = useThemeStore()
    const menuStyle = ref(themeStore.getTheme as 'dark' | 'dark-blue' | 'light')

    const sideMenuOptions = ref([
      {
        label: t('menu.sync_task_definition'),
        key: 'synchronization-definition'
      },
      {
        label: t('menu.sync_task_instance'),
        key: 'synchronization-instance'
      }
    ])

    const handleUpdateValue = (key: string) => {
      router.push({
        path:
          key === 'synchronization-instance'
            ? '/task/synchronization-instance'
            : '/task/synchronization-definition'
      })
    }

    return {
      collapsedRef,
      defaultExpandedKeys,
      menuStyle,
      themeStore,
      sideMenuOptions,
      handleUpdateValue
    }
  },
  render() {
    return (
      <NLayoutSider
        bordered
        nativeScrollbar={false}
        show-trigger='bar'
        collapse-mode='width'
        collapsed={this.collapsedRef}
        onCollapse={() => (this.collapsedRef = true)}
        onExpand={() => (this.collapsedRef = false)}
        width={196}
      >
        <NMenu
          class='tab-vertical'
          value={this.$props.sideKey}
          options={this.sideMenuOptions}
          defaultExpandedKeys={this.defaultExpandedKeys}
          onUpdateValue={this.handleUpdateValue}
        />
      </NLayoutSider>
    )
  }
})

export default Sidebar

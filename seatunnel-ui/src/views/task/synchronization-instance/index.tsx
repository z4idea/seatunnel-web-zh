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

import { defineComponent, ref, KeepAlive } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { SyncTask } from './sync-task'
import './index.css'

const SynchronizationInstance = defineComponent({
  name: 'SynchronizationInstance',
  setup() {
    const route = useRoute()
    const { t } = useI18n()
    const syncTaskType = ref(String(route.query.syncTaskType || 'BATCH'))

    const handleTabChange = (type: string) => {
      syncTaskType.value = type
    }

    return { t, syncTaskType, handleTabChange }
  },
  render() {
    return (
      <div class='sync-instance-page' style={{  borderRadius: '4px', paddingTop: '16px' }}>
        <div class='sync-instance-page__title'>
          <span class='sync-instance-page__title-text'>采集执行历史</span>
        </div>
        
        <div class='sync-instance-page__layout'>
          <div class='sync-instance-page__nav'>
            <div
              class={[
                'sync-instance-page__tab',
                this.syncTaskType === 'BATCH' && 'sync-instance-page__tab--active'
              ]}
              onClick={() => this.handleTabChange('BATCH')}
            >
              {this.syncTaskType === 'BATCH' && (
                <div class='sync-instance-page__tab-indicator' />
              )}
              {this.t('project.synchronization_instance.offline_sync')}
            </div>
            <div
              class={[
                'sync-instance-page__tab',
                this.syncTaskType === 'STREAMING' &&
                  'sync-instance-page__tab--active'
              ]}
              onClick={() => this.handleTabChange('STREAMING')}
            >
              {this.syncTaskType === 'STREAMING' && (
                <div class='sync-instance-page__tab-indicator' />
              )}
              {this.t('project.synchronization_instance.real_time_sync')}
            </div>
          </div>

          <div class='sync-instance-page__content'>
            <KeepAlive>
              {this.syncTaskType === 'BATCH' && (
                <SyncTask syncTaskType='BATCH' key='BATCH' />
              )}
              {this.syncTaskType === 'STREAMING' && (
                <SyncTask syncTaskType='STREAMING' key='STREAMING' />
              )}
            </KeepAlive>
          </div>
        </div>
      </div>
    )
  }
})

export default SynchronizationInstance

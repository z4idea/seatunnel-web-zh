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
import { useRoute, useRouter } from 'vue-router'

import { useI18n } from 'vue-i18n'
import { SyncTask } from './sync-task'

const SynchronizationInstance = defineComponent({
  name: 'SynchronizationInstance',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const { t } = useI18n()
    let syncTaskType = ref(route.query.syncTaskType || 'BATCH')
    
    const handleTabChange = (type: string) => {
      syncTaskType.value = type
    }
   
    return { t, syncTaskType, handleTabChange }
  },
  render() {
    return (
      
       <div >
           <div style={{ display: 'flex', alignItems: 'center',marginBottom:'16px' }}>
          <span className="title-text">采集执行历史</span>
          </div>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '4px', display: 'flex', minHeight: '500px',padding:'16px' }}>
            {/* 左侧 tab 导航 */}
            <div style={{ width: '160px', borderRight: '1px dashed #DDE1ED', paddingTop: '16px' }}>
              <div
                onClick={() => this.handleTabChange('BATCH')}
                style={{
                  padding: '16px 20px 16px 12px',
                  cursor: 'pointer',
                  backgroundColor: this.syncTaskType === 'BATCH' ? '#ffffff' : 'transparent',
                  color: this.syncTaskType === 'BATCH' ? '#1960BC' : '#4b5563',
                  fontWeight: this.syncTaskType === 'BATCH' ? 500 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  position: 'relative',
                  fontSize: '16px',
                  fontFamily: 'PingFang SC'
                }}
              >
                {this.syncTaskType === 'BATCH' && (
                  <div style={{
                    position: 'absolute',
                    left: '0px',
                    width: '4px',
                    height: '20px',
                    backgroundColor: '#1960BC',
                    borderRadius: '2px'
                  }} />
                )}
                {this.t('project.synchronization_instance.offline_sync')}
              </div>
              <div
                onClick={() => this.handleTabChange('STREAMING')}
                style={{
                  padding: '16px 20px 16px 12px',
                  cursor: 'pointer',
                  backgroundColor: this.syncTaskType === 'STREAMING' ? '#ffffff' : 'transparent',
                  color: this.syncTaskType === 'STREAMING' ? '#1960BC' : '#4b5563',
                  fontWeight: this.syncTaskType === 'STREAMING' ? 500 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  position: 'relative',
                  fontSize: '16px',
                  fontFamily: 'PingFang SC'
                }}
              >
                {this.syncTaskType === 'STREAMING' && (
                  <div style={{
                    position: 'absolute',
                    left: '0px',
                    width: '4px',
                    height: '20px',
                    backgroundColor: '#1960BC',
                    borderRadius: '2px'
                  }} />
                )}
                {this.t('project.synchronization_instance.real_time_sync')}
              </div>
            </div>

            {/* 右侧内容区域 */}
            <div style={{ flex: 1, paddingLeft: '16px', overflow: 'auto', position: 'relative', zIndex: 1 }}>
              {this.syncTaskType === 'BATCH' && (
                <KeepAlive>
                  <SyncTask syncTaskType='BATCH' />
                </KeepAlive>
              )}
              {this.syncTaskType === 'STREAMING' && (
                <KeepAlive>
                  <SyncTask syncTaskType='STREAMING' />
                </KeepAlive>
              )}
            </div>
          </div>
        
        </div>
    )
  }
})

export default SynchronizationInstance

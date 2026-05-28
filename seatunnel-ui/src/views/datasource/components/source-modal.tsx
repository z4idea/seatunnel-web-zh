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

import { defineComponent, PropType, ref, watch, h } from 'vue'
import {
  NSpace,
  NModal,
  NCard,
  NButton,
  NEmpty
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useSource } from './use-source'
import styles from './source-model.module.scss'
import type { SelectOption } from 'naive-ui'
import TitleIcon from '@/assets/title-icon.png'

const props = {
  show: {
    type: Boolean as PropType<boolean>,
    default: false
  },
  id: {
    type: Number as PropType<number>
  }
}

const SourceModal = defineComponent({
  name: 'SourceModal',
  props,
  emits: ['change', 'cancel'],
  setup(props, ctx) {
    const { t } = useI18n()
    const { state } = useSource(false)
    const activeTab = ref(state.types[0]?.key || '')
    
    const handleTypeSelect = (type: string) => {
      ctx.emit('change', type)
    }
    const onCancel = () => {
      ctx.emit('cancel')
    }
    const handleTabChange = (key: string) => {
      activeTab.value = key
    }

    watch(
      () => props.show,
      (show) => {
        if (show && state.types.length > 0) {
          activeTab.value = state.types[0].key
        }
      }
    )

    return () => (
      <NModal show={props.show} onMaskClick={onCancel} onEsc={onCancel} style={{ width: '1000px' }}>
        <NCard
          class={styles.content}
          title={h('div', { 
            style: { 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              color: '#2C3947',
              fontWeight: 600,
              fontFamily: 'PingFang SC',
              fontSize: '24px',
              paddingBottom: '12px',
              borderBottom: '1px solid #DFE3E8'
            } 
          }, [
            h('img', { src: TitleIcon, style: { width: '35px', height: '35px' } }),
            h('span', t('datasource.choose_datasource_type'))
          ])}
        >
          <div style={{ display: 'flex', height: '500px' }}>
            {/* 左侧 tab 导航 */}
            <div style={{ width: '160px', borderRight: '1px dashed #DDE1ED', paddingTop: '16px' }}>
              {state.types.map((item) => (
                <div
                  key={item.key}
                  onClick={() => handleTabChange(item.key)}
                  style={{
                    padding: '16px',
                    cursor: 'pointer',
                    backgroundColor: activeTab.value === item.key ? '#ffffff' : 'transparent',
                    color: activeTab.value === item.key ? '#1960BC' : '#4b5563',
                    fontWeight: activeTab.value === item.key ? 500 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    position: 'relative',
                    fontSize: '16px',
                    fontFamily: 'PingFang SC'
                  }}
                >
                  {activeTab.value === item.key && (
                    <div style={{
                      position: 'absolute',
                      left: '0px',
                      width: '4px',
                      height: '20px',
                      backgroundColor: '#1960BC',
                      borderRadius: '2px'
                    }} />
                  )}
                  {item.label}
                </div>
              ))}
            </div>

            {/* 右侧内容区域 */}
            <div style={{ flex: 1, paddingLeft: '16px', overflow: 'auto', position: 'relative', zIndex: 1 }}>
              {state.types.map((item) => (
                activeTab.value === item.key && (
                  <div key={item.key}>
                    <div class={styles['types']}>
                      {item?.children.map((slip: SelectOption) => (
                        <div
                          key={slip.value as string}
                          class={styles.itemBox}
                          onClick={() => handleTypeSelect(slip.value as string)}
                        >
                          <div style={{color:'#303133',fontWeight:'500',fontSize:'18px'}}>{t(slip.label as string)}</div>
                          <div class='text-xs mt-3' style={{color:'#909399',fontSize:'14px'}}>{item.label}</div>
                        </div>
                      ))}
                    </div>
                    {item.children.length === 0 && <NEmpty />}
                  </div>
                )
              ))}
            </div>
          </div>
          <NSpace justify='end'>
            <NButton 
              secondary 
              onClick={onCancel}
              style={{ 
                
                width: '80px', 
                height: '44px', 
                backgroundColor: '#F3F7FB', 
                color: '#1960BC',
                borderRadius:"4px",
                fontWeight:'600',
                fontFamily: 'PingFang SC'
              }}
            >
              {t('datasource.cancel')}
            </NButton>
          </NSpace>
        </NCard>
      </NModal>
    )
  }
})

export default SourceModal

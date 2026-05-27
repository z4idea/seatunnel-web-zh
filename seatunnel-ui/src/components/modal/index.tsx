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

import { defineComponent, PropType, renderSlot } from 'vue'
import { useI18n } from 'vue-i18n'
import { NModal, NCard, NButton, NSpace } from 'naive-ui'

const props = {
  show: {
    type: Boolean as PropType<boolean>,
    default: false
  },
  title: {
    type: String as PropType<string>,
    required: true
  },
  titleIcon: {
    type: String as PropType<string>,
    default: ''
  },
  titleStyle: {
    type: Object as PropType<Record<string, any>>,
    default: () => ({})
  },
  titleIconStyle: {
    type: Object as PropType<Record<string, any>>,
    default: () => ({})
  },
  titleClassName: {
    type: String as PropType<string>,
    default: ''
  },
  cancelText: {
    type: String as PropType<string>
  },
  cancelShow: {
    type: Boolean as PropType<boolean>,
    default: true
  },
  confirmText: {
    type: String as PropType<string>
  },
  confirmClassName: {
    type: String as PropType<string>,
    default: ''
  },
  cancelClassName: {
    type: String as PropType<string>,
    default: ''
  },
  confirmDisabled: {
    type: Boolean as PropType<boolean>,
    default: false
  },
  confirmLoading: {
    type: Boolean as PropType<boolean>,
    default: false
  }
}

const Modal = defineComponent({
  name: 'Modal',
  props,
  emits: ['cancel', 'confirm'],
  setup(props, ctx) {
    const { t } = useI18n()

    const onCancel = () => {
      ctx.emit('cancel')
    }

    const onConfirm = () => {
      ctx.emit('confirm')
    }

    return { t, onCancel, onConfirm }
  },
  render() {
    const { $slots, t, onCancel, onConfirm, confirmDisabled, confirmLoading } =
      this

    const renderTitle = () => {
      const baseTitleStyle = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        color: '#2c3947',
        fontSize: '18px',
        fontWeight: 600,
        width: '100%',
        ...this.titleStyle
      }

      const titleLeftStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }

      const closeBtnStyle = {
        background: 'transparent',
        border: 'none',
        padding: 0,
        margin: 0,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px'
      }

      const titleWrapperClass = this.titleClassName ? [this.titleClassName] : undefined

      const left = this.titleIcon ? (
        <div style={titleLeftStyle}>
          <i
            class={['iconify']}
            data-icon={this.titleIcon}
            data-inline='false'
            style={{ width: '20px', height: '20px', ...this.titleIconStyle }}
          />
          <span>{this.title}</span>
        </div>
      ) : (
        <div style={titleLeftStyle} class={titleWrapperClass}>
          <span>{this.title}</span>
        </div>
      )

      return (
        <div style={baseTitleStyle}>
          {left}
          <button aria-label='close' onClick={onCancel} style={closeBtnStyle}>
            <i class={['iconify']} data-icon={'mdi:close'} data-inline='false' style={{ fontSize: '18px', color: '#a3a5ab' }} />
          </button>
        </div>
      )
    }

    return (
      <NModal
        v-model={[this.show, 'show']}
        mask-closable={false}
        style={{ width: '600px' }}
      >
        <NCard title={renderTitle()} contentStyle={{ overflowY: 'auto' }}>
          {{
            default: () => renderSlot($slots, 'default'),
            footer: () => (
              <NSpace justify='end'>
                {this.cancelShow && (
                  <NButton  secondary onClick={onCancel} style={{ borderRadius: '4px',backgroundColor:'#f3f7fb',color:'#1960bc',height:44+'px',padding:'0 15px' }} class={this.cancelClassName}>
                    {this.cancelText || t('modal.cancel')}
                  </NButton>
                )}
                <NButton
                  size='small'
                  onClick={onConfirm}
                  disabled={confirmDisabled}
                  loading={confirmLoading}
                  type='primary'
                  style={{ borderRadius: '4px',backgroundColor:'#134e9a',color:'#ffffff',height:44+'px',padding:'0 15px' }}
                >
                  {this.confirmText || t('modal.confirm')}
                </NButton>
              </NSpace>
            )
          }}
        </NCard>
      </NModal>
    )
  }
})

export default Modal

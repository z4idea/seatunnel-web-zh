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
import { defineComponent, ref,watch,h } from 'vue'
import {
  NSpace,
  NBreadcrumb,
  NBreadcrumbItem,
  NForm,
  useDialog,
  NInput,
  NButton,
  NFormItemGi,
  NGrid,
  NDivider,
  NIcon,
  NCard,
  NModal
} from 'naive-ui'
import { DynamicFormItem } from '@/components/dynamic-form/dynamic-form-item'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useDetail } from './use-detail'
import { useForm } from './use-form'
import styles from '../index.module.scss'
import SourceModal from '../components/source-modal'
import './index.css'
import TitleIcon from '@/assets/title-icon.png'
const DatasourceCreate = defineComponent({
  name: 'DatasourceCreate',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    SourceId:{
       type: String,
        default: ''
    },
    onClose: {
      type: Function,
      default: () => {}
    }
  },
  setup(props) {
    const SourceId = ref(props.SourceId)
    const { t } = useI18n()
    const route = useRoute()
    const router = useRouter()
    const dialog = useDialog()
    const showSourceModal = ref(false)
    const detailFormRef = ref(null)

    const { state, changeType, getFieldsValue, setFieldsValue, getFormItems } =
      useForm(route.query.type as string)

    const { status, testConnect, createOrUpdate, queryById } = useDetail(
      getFieldsValue,
      setFieldsValue,
      getFormItems,
      detailFormRef,
      SourceId
    )

    const handleClose = () => {
      props.onClose()
    }

    const onClose = () => {
      dialog.warning({
        title: t('datasource.warning'),
        content: t('datasource.close_confirm_tips'),
        onPositiveClick: () => {
          handleClose()
          router.push({
            name: 'datasource-list'
          })
        },
        positiveText: t('datasource.confirm'),
        negativeText: t('datasource.cancel')
      })
    }
    watch(() => props.SourceId, (newVal) => {
      SourceId.value = newVal
      if (newVal) {
        queryById(newVal)
      }
    })
    return () => (
     <NModal show={props.show}  style={{width:'1000px'}} contentStyle={{ maxHeight: '80vh', overflow: 'auto' }}>
        <div class="sync-definition-wrapper" style={{backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', gap: '16px',borderRadius:'16px',padding:'0'
         }}>
          <NCard  
          
          title={h('div', { 
            style: { 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              paddingBottom: '12px',
              borderBottom: '1px solid #DFE3E8'
            } 
          }, [
            h('div', {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }
            }, [
              h('img', { src: TitleIcon, style: { width: '35px', height: '35px' } }),
              h('span', {
                style: {
                  color: '#2C3947',
                  fontWeight: 600,
                  fontFamily: 'PingFang SC',
                  fontSize: '24px'
                }
              }, t('datasource.create_datasource'))
            ]),
            // h(NButton, {
            //   text: true,
            //   style: {
            //     padding: '4px',
            //     fontSize: '20px',
            //     color: '#999',
            //     cursor: 'pointer'
            //   },
            //   onClick: () => handleClose()
            // }, {
            //   default: () => h(NIcon, null, {
            //     default: () => h('i', { 
            //       class: 'iconify', 
            //       'data-icon': 'material-symbols:close', 
            //       'data-inline': 'false',
            //       style: { fontSize: '24px' }
            //     })
            //   })
            // })
          ])}>
             <div style={{ backgroundColor: '#ffffff',  padding: '0 16px' }}>
            <NForm
              rules={state.rules}
              ref={detailFormRef}
              class={styles['detail-content']}
              label-placement="left"
              label-width="150px"
            >
              <NGrid xGap={10}>
                <NFormItemGi
                  label={t('datasource.datasource_type')}
                  path='type'
                  show-require-mark
                  span={24}
                >
                  <NSpace
                    class={[
                      styles.typeBox,
                      !!route.params.id && styles.disabledBox
                    ]}
                  >
                    <div>{state.detailForm.pluginName}</div>
                    {!route.params.id && (
                      <NButton
                        text
                        type='primary'
                        onClick={() => void (showSourceModal.value = true)}
                      >
                        {t('datasource.select')}
                      </NButton>
                    )}
                  </NSpace>
                </NFormItemGi>
                <NFormItemGi
                  label={t('datasource.datasource_name')}
                  path='name'
                  show-require-mark
                  span={12}
                >
                  <NInput
                    class='input-data-source-name'
                    v-model={[state.detailForm.datasourceName, 'value']}
                    maxlength={60}
                    placeholder={t('datasource.datasource_name_tips')}
                  />
                </NFormItemGi>
                <NFormItemGi
                  label={t('datasource.description')}
                  path='note'
                  span={12}
                >
                  <NInput
                    class='input-data-source-description'
                    v-model={[state.detailForm.description, 'value']}
                    type='textarea'
                    placeholder={t('datasource.description_tips')}
                    rows={1}
                  />
                </NFormItemGi>
              </NGrid>
              {state.formStructure.length > 0 && (
                <DynamicFormItem
                  model={state.detailForm}
                  formStructure={state.formStructure}
                  name={state.formName}
                  locales={state.locales}
                />
              )}
              </NForm>
            </div>
            <div style={{borderTop: '1px solid #DFE3E8', padding: '16px 0'}}>
              <NSpace justify="end">
              <NButton secondary class="create-btn1" onClick={testConnect} loading={status.testing}>
                 <NIcon>
                                <i class='iconify' data-icon='material-symbols:link' data-inline='false' style={{ fontSize: '16px' }} />
                              </NIcon>
                {t('datasource.test_connect')}
              </NButton>
              <NButton class="create-btn1" secondary onClick={onClose}>
                {t('datasource.cancel')}
              </NButton>
              <NButton class="create-btn" onClick={createOrUpdate} loading={status.saving}>
                {t('datasource.confirm')}
              </NButton>
            </NSpace>
            </div>
          </NCard>
        {/* <div style={{ backgroundColor: '#ffffff', marginTop: '16px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
            
          </div>
        </div> */}
       
        <SourceModal
          show={showSourceModal.value}
          onChange={(type) => {
            changeType(type)
            showSourceModal.value = false
          }}
          onCancel={() => void (showSourceModal.value = false)}
        />
      </div>
     </NModal>
      
    )
  }
})

export default DatasourceCreate

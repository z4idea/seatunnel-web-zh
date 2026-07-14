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

import { defineComponent, onMounted, ref, toRefs, watch } from 'vue'
import {
  NButton,
  NInput,
  NIcon,
  NDataTable,
  NPagination,
  NSpace,
  NCard
} from 'naive-ui'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useColumns } from './use-columns'
import { useTable } from './use-table'
import styles from '../index.module.scss'
import SourceModal from '../components/source-modal'
import type { Ref } from 'vue'
import type { TableColumns } from 'naive-ui/es/data-table/src/interface'
import '@iconify/iconify'
import './list.css'
import EditModal from '../create/index'
const DatasourceList = defineComponent({
  setup: function() {
    const { t } = useI18n()
    const showSourceModal = ref(false)
    const showEditModal = ref<boolean>(false)
    const SourceId = ref<string>('')
    const sourceType = ref<string>('')
    const columns: Ref<TableColumns> = ref([])
    const router = useRouter()
    const route = useRoute()
    const { data, changePage, changePageSize, deleteRecord, updateList } =
      useTable()

    const handleSearch = () => {
      updateList()
    }

    const { getColumns } = useColumns((id: string, type: 'edit' | 'delete') => {
      if (type === 'edit') {
        SourceId.value = id   
        // router.push({ name: 'datasource-edit', params: { id } })
        showEditModal.value = true
      } else  if(type === 'delete'){
        deleteRecord(id)
      }
    })

    const onCreate = () => {
      SourceId.value = ''
      showSourceModal.value = true
    }

    const closeSourceModal = () => {
      showSourceModal.value = false
    }

    const handleSelectSourceType = (value: string) => {
      SourceId.value = ''
      sourceType.value = value
      showEditModal.value = true
      closeSourceModal()
    }

    const initSearch = () => {
      const { searchVal } = route.query
      if (searchVal) {
        data.searchVal = searchVal as string
      }
    }

    onMounted(() => {
      initSearch()
      if (!route.query.tab || route.query.tab === 'datasource') {
        changePage(1)
        columns.value = getColumns()
      }
    })
    
    const closeEditModal = () => {
      showEditModal.value = false
      SourceId.value = ''
      sourceType.value = ''
      updateList()
    }
    
    watch(useI18n().locale, () => {
      columns.value = getColumns()
    })
  
    return {
      t,
      showSourceModal,
      columns,
      ...toRefs(data),
      changePage,
      changePageSize,
      onCreate,
      handleSearch,
      handleSelectSourceType,
      closeSourceModal,
      showEditModal,
      SourceId,
      closeEditModal,
      sourceType
    }
  },
  render() {
    const {
      t,
      showSourceModal,
      columns,
      list,
      page,
      pageSize,
      itemCount,
      changePage,
      changePageSize,
      onCreate,
      handleSelectSourceType,
      closeSourceModal,
      showEditModal,
      SourceId,
      closeEditModal,
      sourceType
    } = this

    return (
      <div class="sync-definition-wrapper" >
        <div style={{ height: '50px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span class="title-text">{t('datasource.datasource')}</span>
          </div>
         
        </div>
        {/* <NCard title={t('datasource.datasource')}>
          
        </NCard> */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '4px', padding: '16px' }}>
          <div style={{ marginBottom: '16px',display:'flex',justifyContent:'space-between' }}>
            <div>
               <NButton onClick={onCreate}  class="create-btn">
                <NIcon>
                  <i class='iconify' data-icon='icon-park-outline:add' data-inline='false' style={{ fontSize: '16px' }} />
                </NIcon>
                <span style={{paddingLeft:'5px'}}>{t('datasource.create')}</span>
              </NButton>
            </div>
            <div>
                <NSpace>
                <NInput
                  v-model={[this.searchVal, 'value']}
                  placeholder={t('datasource.search_input_tips')}
                  style={{ width: '200px' }}
                />
                <NButton onClick={this.handleSearch}  class="create-btn">
                  <NIcon>
                    <i class='iconify' data-icon='icon-park-outline:search'  data-inline='false' style={{ fontSize: '16px' }} />
                  </NIcon>
                  <span style={{paddingLeft:'5px'}}>{t('datasource.search')}</span>
                </NButton>
           
               </NSpace>
            </div>
           
          </div>
          <NDataTable
            row-class-name='data-source-items'
            columns={columns}
            data={list}
            striped
          />
          <div class="sync-pagination-bar">
            <NPagination
              v-model:page={this.page}
              v-model:page-size={this.pageSize}
              item-count={itemCount}
              show-quick-jumper
              show-size-picker
              page-sizes={[10, 30, 50]}
              class={styles['pagination']}
              on-update:page={changePage}
              on-update:page-size={changePageSize}
            />
          </div>
          
        </div>
        <SourceModal
          show={showSourceModal}
          onChange={handleSelectSourceType}
          onCancel={closeSourceModal}
        />
        <EditModal show={showEditModal} SourceId={SourceId} sourceType={sourceType}  onClose={closeEditModal} />
        
      
      </div>
    )
  }
})
export default DatasourceList

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

import { computed, defineComponent, h, reactive } from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
  NInput,
  NInputGroup,
  NModal,
  NSpace,
  NTag
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { getLocalFileRoots, listLocalFiles } from '@/service/local-file'
import type { PropType } from 'vue'
import type { DataTableColumns } from 'naive-ui'
import type { LocalFileEntry } from '@/service/local-file'

const props = {
  model: {
    type: Object as PropType<Record<string, any>>,
    required: true
  }
}

const LocalFilePicker = defineComponent({
  name: 'LocalFilePicker',
  props,
  setup(props) {
    const { t } = useI18n()
    const state = reactive({
      show: false,
      loading: false,
      currentPath: '',
      entries: [] as LocalFileEntry[],
      keyword: ''
    })

    const loadRoots = async () => {
      state.loading = true
      try {
        state.currentPath = ''
        state.keyword = ''
        state.entries = await getLocalFileRoots()
      } finally {
        state.loading = false
      }
    }

    const loadPath = async (path: string) => {
      state.loading = true
      try {
        state.currentPath = path
        state.keyword = ''
        state.entries = await listLocalFiles(path)
      } finally {
        state.loading = false
      }
    }

    const open = async () => {
      state.show = true
      if (props.model.path) {
        await loadPath(props.model.path)
      } else {
        await loadRoots()
      }
    }

    const close = () => {
      state.show = false
    }

    const filteredEntries = computed(() => {
      const keyword = state.keyword.trim().toLowerCase()
      if (!keyword) {
        return state.entries
      }
      return state.entries.filter((entry) =>
        entry.name.toLowerCase().includes(keyword)
      )
    })

    const choose = async (entry: LocalFileEntry) => {
      if (entry.directory) {
        await loadPath(entry.path)
        return
      }
      if (!entry.selectable) {
        return
      }
      props.model.path = entry.path
      props.model.file_format_type = entry.fileFormatType
      state.show = false
    }

    const parentPath = (path: string) => {
      const value = String(path || '').replace(/[\\/]+$/, '')
      if (!value) return ''
      if (/^[A-Za-z]:$/.test(value)) return ''
      const index = Math.max(value.lastIndexOf('/'), value.lastIndexOf('\\'))
      if (index <= 0) return value.startsWith('/') ? '/' : ''
      return value.substring(0, index)
    }

    const goParent = async () => {
      const parent = parentPath(state.currentPath)
      if (parent) {
        await loadPath(parent)
      } else {
        await loadRoots()
      }
    }

    const columns: DataTableColumns<LocalFileEntry> = [
      {
        title: t('datasource.local_file_name'),
        key: 'name',
        ellipsis: {
          tooltip: true
        },
        render: (row) =>
          h(
            NButton,
            {
              text: true,
              type: row.directory || row.selectable ? 'primary' : 'default',
              disabled: !row.directory && !row.selectable,
              onClick: () => choose(row)
            },
            () => row.name
          )
      },
      {
        title: t('datasource.local_file_type'),
        key: 'fileFormatType',
        width: 120,
        render: (row) =>
          row.directory
            ? h(NTag, { size: 'small' }, () => t('datasource.local_file_dir'))
            : row.selectable
            ? h(NTag, { size: 'small', type: 'success' }, () =>
                row.fileFormatType
              )
            : h(NTag, { size: 'small' }, () =>
                t('datasource.local_file_unsupported')
              )
      },
      {
        title: t('datasource.local_file_size'),
        key: 'size',
        width: 120,
        render: (row) => (row.directory ? '-' : `${row.size}`)
      }
    ]

    return () => (
      <>
        <NInputGroup>
          <NInput
            v-model={[props.model.path, 'value']}
            placeholder={t('datasource.local_file_path_placeholder')}
            clearable
          />
          <NButton onClick={open}>{t('datasource.local_file_browse')}</NButton>
        </NInputGroup>
        <NModal show={state.show} onMaskClick={close} onEsc={close}>
          <NCard
            style={{ width: '760px' }}
            title={t('datasource.local_file_select')}
            bordered={false}
          >
            <NSpace vertical>
              <NSpace justify='space-between'>
                <NInput
                  value={state.currentPath || t('datasource.local_file_roots')}
                  readonly
                />
                <NSpace>
                  <NButton onClick={goParent} disabled={state.loading}>
                    {t('datasource.local_file_parent')}
                  </NButton>
                  <NButton onClick={loadRoots} disabled={state.loading}>
                    {t('datasource.local_file_roots')}
                  </NButton>
                </NSpace>
              </NSpace>
              <NInput
                v-model={[state.keyword, 'value']}
                placeholder={t('datasource.local_file_search_placeholder')}
                clearable
              />
              <NDataTable
                size='small'
                loading={state.loading}
                columns={columns}
                data={filteredEntries.value}
                maxHeight={420}
                rowKey={(row) => row.path}
              />
              <NSpace justify='end'>
                <NButton onClick={close}>{t('datasource.cancel')}</NButton>
              </NSpace>
            </NSpace>
          </NCard>
        </NModal>
      </>
    )
  }
})

export default LocalFilePicker

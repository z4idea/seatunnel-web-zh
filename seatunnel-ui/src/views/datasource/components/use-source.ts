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
import { onMounted, reactive, watch } from 'vue'
import { getDatasourceType } from '@/service/data-source'
import { useI18n } from 'vue-i18n'
import type { SelectOption } from 'naive-ui'
import type { ResponseBasic } from '@/service/types'
import type { DatasourceTypeList } from '@/service/data-source/types'

type Key = '1' | '2' | '3' | '4' | '5'
type IType = {
  type: string
  label: string
  key: string
  children: SelectOption[]
}

const DATASOURCE_PRIORITY_KEYWORDS = ['mysql', 'oracle', 'sqlserver', 'dm']
const HIDDEN_DATASOURCE_TYPE_KEYS = ['storage', 'fake_connection']

const getDatasourcePriority = (name: string): number => {
  const lowerName = name.toLowerCase()
  const priority = DATASOURCE_PRIORITY_KEYWORDS.findIndex((keyword) =>
    lowerName.includes(keyword)
  )
  return priority === -1 ? Number.MAX_SAFE_INTEGER : priority
}

const sortDatasourceOptions = (options: SelectOption[]): SelectOption[] => {
  return options
    .map((option, index) => ({
      option,
      index,
      priority: getDatasourcePriority((option.label as string) || '')
    }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map(({ option }) => option)
}

export const useSource = (showVirtualDataSource = false) => {
  const i18n = useI18n()
  const TYPE_MAP = {
    1: 'database',
    2: 'file',
    3: 'no_structured',
    4: 'storage',
    5: 'remote_connection',
    6: 'fake_connection'
  }
  const state = reactive({
    types: [] as IType[]
  })

  const querySource = () => {
    getDatasourceType({
      showVirtualDataSource,
      source: 'WT'
    }).then((res: ResponseBasic<Array<DatasourceTypeList> | Array<any>>) => {
      const locales = {
        zh_CN: {} as { [key: string]: string },
        en_US: {} as { [key: string]: string }
      }

      state.types = Object.entries(res)
        .map(([key, value]) => {
          const typeKey = TYPE_MAP[key as Key]
          const options = (value as any).map((item: any) => {
            locales.zh_CN[item.name] =
              item.name === 'LocalFile' ? '本地文件' : item.chineseName
            locales.en_US[item.name] = item.name
            return {
              label: item.name,
              value: item.name
            }
          })
          return {
            type: 'group',
            label: i18n.t(`datasource.${typeKey}`),
            key: typeKey,
            children:
              typeKey === 'database' ? sortDatasourceOptions(options) : options
          }
        })
        .filter((item) => !HIDDEN_DATASOURCE_TYPE_KEYS.includes(item.key))

      i18n.mergeLocaleMessage('zh_CN', locales.zh_CN)
      i18n.mergeLocaleMessage('en_US', locales.en_US)
    })
  }

  onMounted(() => {
    querySource()
  })

  watch(useI18n().locale, () => {
    querySource()
  })

  return { state }
}

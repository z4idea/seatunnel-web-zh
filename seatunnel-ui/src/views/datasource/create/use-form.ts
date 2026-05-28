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

import { onMounted, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  useFormStructuresStore,
  StructureItem
} from '@/store/datasource'
import { dynamicFormItems } from '@/service/data-source'
import { useFormField } from '@/components/dynamic-form/use-form-field'
import { useFormRequest } from '@/components/dynamic-form/use-form-request'
import { useFormValidate } from '@/components/dynamic-form/use-form-validate'
import { useFormStructure } from '@/components/dynamic-form/use-form-structure'
import type { FormRules } from 'naive-ui'
import type { ResponseBasic } from '@/service/types'
import {
  JDBC_DATABASE_FIELD,
  JDBC_HOST_FIELD,
  JDBC_PORT_FIELD,
  JDBC_URL_PARAMS_FIELD,
  getJdbcFieldHintByPlugin,
  isJdbcPlugin
} from './jdbc-url'

export function useForm(type: string) {
  const { t } = useI18n()
  const router = useRouter()
  const formStructuresStore = useFormStructuresStore()

  const initialValues = {
    pluginName: type,
    datasourceName: '',
    description: ''
  }

  const state = reactive({
    detailForm: { ...initialValues },
    formName: '',
    formStructure: [] as StructureItem[],
    locales: {},
    rules: {
      name: {
        trigger: ['input'],
        validator() {
          if (!state.detailForm.datasourceName) {
            return new Error(t('datasource.datasource_name_tips'))
          }
        }
      }
    } as FormRules
  })

  const buildJdbcFormItems = (forms: Array<any>, pluginName: string) => {
    if (!isJdbcPlugin(pluginName)) return forms
    const urlIndex = forms.findIndex((item) => item.field === 'url')
    if (urlIndex < 0) return forms

    const hints = getJdbcFieldHintByPlugin(pluginName)
    const urlField = forms[urlIndex]
    const nextForms = forms.filter((item) => item.field !== 'url')
    const jdbcFields = [
      {
        field: JDBC_HOST_FIELD,
        label: t('datasource.jdbc_host'),
        type: 'input',
        placeholder: t('datasource.jdbc_host_placeholder'),
        span: 12,
        clearable: true
      },
      {
        field: JDBC_PORT_FIELD,
        label: t('datasource.jdbc_port'),
        type: 'input',
        placeholder: t('datasource.jdbc_port_placeholder'),
        span: 12,
        clearable: true
      },
      {
        field: JDBC_DATABASE_FIELD,
        label: t('datasource.jdbc_database'),
        type: 'input',
        placeholder: hints.databasePlaceholder,
        span: 12,
        clearable: true
      },
      {
        field: JDBC_URL_PARAMS_FIELD,
        label: t('datasource.jdbc_url_params'),
        type: 'input',
        placeholder: `${hints.paramsPlaceholder} (e.g. ${hints.urlExample})`,
        span: 12,
        clearable: true
      },
      {
        ...urlField,
        show: { field: JDBC_HOST_FIELD, value: ['__never__'] }
      }
    ]
    nextForms.splice(urlIndex, 0, ...jdbcFields)
    return nextForms
  }

  const getFormItems = async (value: string) => {
    state.formName = value
    const clearJdbcRules = () => {
      delete state.rules[JDBC_HOST_FIELD]
      delete state.rules[JDBC_PORT_FIELD]
      delete state.rules.url
    }
    const applyJdbcRules = (pluginName: string) => {
      clearJdbcRules()
      if (!isJdbcPlugin(pluginName)) return
      state.rules[JDBC_HOST_FIELD] = {
        trigger: ['input', 'blur'],
        validator() {
          if (!state.detailForm[JDBC_HOST_FIELD]) {
            return new Error(t('datasource.jdbc_host_required'))
          }
        }
      }
      state.rules[JDBC_PORT_FIELD] = {
        trigger: ['input', 'blur'],
        validator() {
          const port = String(state.detailForm[JDBC_PORT_FIELD] || '').trim()
          if (!port) {
            return new Error(t('datasource.jdbc_port_required'))
          }
          if (!/^\d+$/.test(port)) {
            return new Error(t('datasource.jdbc_port_numeric'))
          }
        }
      }
    }

    if (formStructuresStore.getItem(value)) {
      const cachedForms = formStructuresStore.getItem(value) as StructureItem[]
      state.formStructure = cachedForms
      Object.assign(state.detailForm, useFormField(cachedForms as Array<any>))
      Object.assign(
        state.rules,
        useFormValidate(cachedForms as Array<any>, state.detailForm, t)
      )
      applyJdbcRules(value)
      return
    }

    const result: any = await dynamicFormItems(value)

    try {
      const res = JSON.parse(result)
      res.forms = buildJdbcFormItems(
        res.forms.map((form: any) => ({ ...form, span: 12 })),
        value
      )
      Object.assign(state.detailForm, useFormField(res.forms))
      Object.assign(
        state.rules,
        useFormValidate(res.forms, state.detailForm, t)
      )
      applyJdbcRules(value)
      state.locales = res.locales
      state.formStructure = useFormStructure(
        res.apis ? useFormRequest(res.apis, res.forms) : res.forms
      ) as any
    } finally {}
  }

  const changeType = (value: string) => {
    router.replace({ name: 'datasource-create', query: { type: value } })
    getFormItems(value)
  }

  const resetFieldsValue = () => {
    state.detailForm = { ...initialValues }
  }

  const setFieldsValue = (values: any) => {
    Object.assign(state.detailForm, values)
  }

  const getFieldsValue = () => state.detailForm

  onMounted(() => {
    if (type) {
      getFormItems(type)
    }
  })

  return {
    state,
    changeType,
    resetFieldsValue,
    getFieldsValue,
    setFieldsValue,
    getFormItems
  }
}

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

import { defineComponent } from 'vue'
import {
  NFormItemGi,
  NGrid,
  NInput,
  NSelect,
  NCheckboxGroup,
  NSpace,
  NCheckbox
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { PropType } from 'vue'
import type { SelectOption } from 'naive-ui'

const props = {
  formStructure: {
    type: Object as PropType<Array<object>>
  },
  model: {
    type: Object as PropType<object>
  },
  name: {
    type: String as PropType<string>,
    default: ''
  },
  locales: {
    type: Object as PropType<object>
  }
}

const DynamicFormItem = defineComponent({
  name: 'DynamicFormItem',
  props,
  setup(props) {
    const { t, te } = useI18n()

    if (props.locales) {
      useI18n().mergeLocaleMessage('zh_CN', {
        i18n: (props.locales as any).zh_CN
      })
      useI18n().mergeLocaleMessage('en_US', {
        i18n: (props.locales as any).en_US
      })
    }

    const formatClass = (name: string, modelField: string) => {
      return name.indexOf('[') >= 0
        ? name.split('[')[0].toLowerCase() + name.split('[')[1].split(']')[0]
        : name.toLowerCase() + '-' + modelField.toLowerCase()
    }

    const formItemDisabled = (field: string, value: Array<any>) => {
      return value.map((v) => field === v).indexOf(false) < 0
    }

    const normalizeKey = (value: string) =>
      String(value || '')
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase()

    const getTranslation = (
      name: string,
      label: string,
      suffix: string,
      field?: string
    ) => {
      const normalizedLabel = normalizeKey(label)
      const normalizedField = field ? normalizeKey(field) : ''
      const keys = [
        `transforms.${name.toLowerCase()}.${label}_${suffix}`,
        field ? `transforms.${name.toLowerCase()}.${field}_${suffix}` : '',
        `transforms.${name.toLowerCase()}.${normalizedLabel}_${suffix}`,
        normalizedField
          ? `transforms.${name.toLowerCase()}.${normalizedField}_${suffix}`
          : '',
        `transforms.common.${normalizedLabel}_${suffix}`,
        normalizedField ? `transforms.common.${normalizedField}_${suffix}` : ''
      ].filter(Boolean)

      const matched = keys.find((key) => te(key))
      return matched ? t(matched) : ''
    }

    const translateOptionLabel = (name: string, label: string) => {
      const normalizedLabel = normalizeKey(label)
      const keys = [
        `transforms.${name.toLowerCase()}.option_${label}`,
        `transforms.${name.toLowerCase()}.option_${normalizedLabel}`,
        `transforms.common.option_${label}`,
        `transforms.common.option_${normalizedLabel}`,
        label
      ]

      const matched = keys.find((key) => te(key))
      return matched ? t(matched) : label
    }

    return {
      t,
      te,
      getTranslation,
      translateOptionLabel,
      formatClass,
      formItemDisabled
    }
  },
  render() {
    return (
      <NGrid xGap={10}>
        {(this.formStructure as Array<any>).map((f) => {
          return (
            (f.show
              ? this.formItemDisabled(
                  (this.model as any)[f.show.field],
                  f.show.value
                )
              : true) && (
              <NFormItemGi
                label={this.t(
                  this.getTranslation(this.name, f.label, 'value', f.field) ||
                    this.t(f.label)
                )}
                path={f.field}
                span={f.span || 24}
              >
                {f.type === 'input' && (
                  <NInput
                    class={`dynamic-form_${this.formatClass(
                      this.name,
                      f.field
                    )}`}
                    placeholder={
                      f.placeholder 
                        ? (
                            this.getTranslation(
                              this.name,
                              f.label,
                              'placeholder',
                              f.field
                            ) || this.t(f.placeholder)
                          )
                        : ''
                    }
                    v-model={[(this.model as any)[f.field], 'value']}
                    clearable={f.clearable}
                    type={f.inputType}
                    rows={f.row ? f.row : 4}
                  />
                )}
                {f.type === 'select' &&
                  (f.show
                    ? this.formItemDisabled(
                        (this.model as any)[f.show.field],
                        f.show.value
                      )
                    : true) && (
                    <NSelect
                      class={`dynamic-form_${this.formatClass(
                        this.name,
                        f.field
                      )}`}
                      placeholder={
                        f.placeholder
                          ? this.getTranslation(
                              this.name,
                              f.label,
                              'placeholder',
                              f.field
                            ) || this.t(f.placeholder)
                          : ''
                      }
                      v-model={[(this.model as any)[f.field], 'value']}
                      options={
                        f.options.map((o: SelectOption) => {
                          return {
                            label: this.translateOptionLabel(
                              this.name,
                              o.label as string
                            ),
                            value: o.value
                          }
                        })
                      }
                    />
                  )}
                {f.type === 'checkbox' &&
                  (f.show
                    ? this.formItemDisabled(
                        (this.model as any)[f.show.field],
                        f.show.value
                      )
                    : true) && (
                    <NCheckboxGroup
                      class={`dynamic-form_${this.formatClass(
                        this.name,
                        f.field
                      )}`}
                      v-model={[(this.model as any)[f.field], 'value']}
                    >
                      <NSpace vertical={f.vertical}>
                        {f.options.map((o: any) => (
                          <NCheckbox
                            label={this.translateOptionLabel(
                              this.name,
                              o.label as string
                            )}
                            value={o.value}
                          />
                        ))}
                      </NSpace>
                    </NCheckboxGroup>
                  )}
              </NFormItemGi>
            )
          )
        })}
      </NGrid>
    )
  }
})

export { DynamicFormItem }

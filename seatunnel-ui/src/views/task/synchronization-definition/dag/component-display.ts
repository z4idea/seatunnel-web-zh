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

import type { NodeType } from './types'

type Translate = (key: string) => string

const componentDisplayKeyMap: Record<string, string> = {
  Source: 'source',
  Sink: 'sink',
  Copy: 'copy_transform',
  FieldMapper: 'field_mapper',
  FilterRowKind: 'filter_row_kind',
  JsonPath: 'json_path',
  MultiFieldSplit: 'multi_field_split',
  Replace: 'replace_transform',
  Sql: 'sql_transform'
}

const defaultDisplayNameMap: Record<string, string> = {
  Source: 'Source',
  Sink: 'Sink',
  Copy: 'Copy',
  FieldMapper: 'Field Mapper',
  FilterRowKind: 'Filter Row Kind',
  JsonPath: 'JSON Path',
  MultiFieldSplit: 'Multi Field Split',
  Replace: 'Replace',
  Sql: 'SQL Transform'
}

const knownDefaultNames = new Set([
  ...Object.keys(componentDisplayKeyMap),
  ...Object.values(defaultDisplayNameMap),
  '数据源',
  '目标',
  '字段复制',
  '字段映射',
  '记录类型过滤',
  'JSON 路径解析',
  '多字段拆分',
  '字段替换',
  'SQL 转换'
])

export const getComponentDisplayName = (name: string, t?: Translate) => {
  const localeKey = componentDisplayKeyMap[name]

  if (t && localeKey) {
    return t(`project.synchronization_definition.${localeKey}`)
  }

  return defaultDisplayNameMap[name] || name
}

export const getDefaultNodeName = (
  nodeType: NodeType,
  transformType: string,
  t?: Translate
) => {
  if (nodeType === 'source') {
    return getComponentDisplayName('Source', t)
  }

  if (nodeType === 'sink') {
    return getComponentDisplayName('Sink', t)
  }

  if (nodeType === 'transform' && transformType) {
    return getComponentDisplayName(transformType, t)
  }

  return ''
}

export const isComponentDefaultName = (name: string) => {
  return knownDefaultNames.has(name)
}

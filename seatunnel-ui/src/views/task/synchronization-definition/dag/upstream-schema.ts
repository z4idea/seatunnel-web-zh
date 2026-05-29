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

import { queryTaskDetail } from '@/service/sync-task-definition'

export type UpstreamTableSchema = {
  database?: string
  tableName?: string
  fields?: Array<Record<string, any>>
}

const UPSTREAM_FIELD_SELECTOR =
  /(group|field|column|key|aggregate|agg|metric|measure|dimension)/i

export const isUpstreamFieldSelector = (field: string, label = '') => {
  const normalized = `${field} ${label}`.toLowerCase()
  return UPSTREAM_FIELD_SELECTOR.test(normalized)
}

export const fieldsToSelectOptions = (fields: Array<Record<string, any>> = []) =>
  fields
    .filter((field) => field?.name)
    .map((field) => ({
      label: field.outputDataType
        ? `${field.name} (${field.outputDataType || field.type || '-'})`
        : field.name,
      value: field.name
    }))

export const normalizeUpstreamOutputSchema = (
  outputSchema: UpstreamTableSchema[] = []
) =>
  outputSchema
    .filter((table) => table?.fields?.length)
    .map((table) => ({
      database: table.database || 'default',
      tableName: table.tableName || 'default',
      fields: table.fields || []
    }))

export async function fetchUpstreamOutputSchema(
  jobCode: string,
  predecessorsNodeId?: string,
  fallbackSchema: UpstreamTableSchema[] = []
): Promise<UpstreamTableSchema[]> {
  const normalizedFallback = normalizeUpstreamOutputSchema(fallbackSchema)

  if (predecessorsNodeId) {
    try {
      const res = await queryTaskDetail(jobCode, predecessorsNodeId)
      const fromApi = normalizeUpstreamOutputSchema(res?.outputSchema || [])
      if (fromApi.length) {
        return fromApi
      }
    } catch {
      // fall back to in-memory upstream schema from the graph node
    }
  }

  return normalizedFallback
}

export const getUpstreamFields = (outputSchema: UpstreamTableSchema[] = []) =>
  outputSchema[0]?.fields || []

export function applyUpstreamFieldOptions(
  formStructure: Array<any>,
  upstreamFields: Array<Record<string, any>>
) {
  const options = fieldsToSelectOptions(upstreamFields)
  if (!options.length) return

  formStructure.forEach((form) => {
    if (
      (form.type === 'select' || form.type === 'checkbox') &&
      isUpstreamFieldSelector(String(form.field || ''), String(form.label || ''))
    ) {
      form.options = options
      form.filterable = true
      form.disabled = false
    }
  })
}

export function buildModelTableData(outputSchema: UpstreamTableSchema[]) {
  const normalized = normalizeUpstreamOutputSchema(outputSchema)
  if (!normalized.length) {
    return null
  }

  return {
    tables: normalized.map((table) => table.tableName),
    currentTable: normalized[0].tableName,
    allTableData: [
      {
        database: normalized[0].database,
        tableInfos: normalized
      }
    ]
  }
}

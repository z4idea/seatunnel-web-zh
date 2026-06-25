/* @author: zhjj */
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

import { useMessage } from 'naive-ui'
import i18n from '@/locales'

type MessageApi = ReturnType<typeof useMessage>
type MessageContent = Parameters<MessageApi['error']>[0]
type MessageOptions = Parameters<MessageApi['error']>[1]

const PERSISTENT_ERROR_OPTIONS = {
  closable: true,
  duration: 0
} satisfies NonNullable<MessageOptions>

const containsChinese = /[\u3400-\u9fff]/

const getLocale = () => {
  const locale = i18n.global.locale
  return typeof locale === 'string' ? locale : locale.value
}

const isZhLocale = () => String(getLocale()).startsWith('zh')

const t = (key: string, params?: Record<string, string | number>) =>
  String(i18n.global.t(key, params || {}))

const normalizeMessageText = (value: string) => value.trim().replace(/\s+/g, ' ')

const joinSentence = (summary: string, detail?: string) => {
  const normalizedDetail = detail?.trim()
  if (!normalizedDetail) {
    return summary
  }
  return isZhLocale()
    ? `${summary}。${normalizedDetail}`
    : `${summary}. ${normalizedDetail}`
}

const joinDetail = (summary: string, detail?: string) => {
  const normalizedDetail = detail?.trim()
  if (!normalizedDetail) {
    return summary
  }
  return isZhLocale()
    ? `${summary}：${normalizedDetail}`
    : `${summary}: ${normalizedDetail}`
}

const translateParameterName = (name: string) => {
  const normalizedName = normalizeMessageText(name)
  const paramLabels = {
    jobDefineId: 'common.param_labels.jobDefineId',
    pluginId: 'common.param_labels.pluginId',
    enabled: 'common.param_labels.enabled',
    cronExpression: 'common.param_labels.cronExpression',
    name: 'common.param_labels.name',
    description: 'common.param_labels.description',
    path: 'common.param_labels.path',
    url: 'common.param_labels.url',
    datasourceName: 'common.param_labels.datasourceName',
    databaseName: 'common.param_labels.databaseName',
    tableName: 'common.param_labels.tableName',
    'jobDefineId and enabled': 'common.param_labels.jobDefineIdAndEnabled'
  } as Record<string, string>

  return paramLabels[normalizedName] ? t(paramLabels[normalizedName]) : normalizedName
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Object.prototype.toString.call(value) === '[object Object]'
}

const tryParseJson = (value: string): unknown => {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

const flattenMessage = (value: unknown): string[] => {
  if (value === null || value === undefined) {
    return []
  }

  if (typeof value === 'string') {
    const parsed = tryParseJson(value)
    if (parsed !== value) {
      return flattenMessage(parsed)
    }
    return value.trim() ? [value] : []
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenMessage(item))
  }

  if (isPlainObject(value)) {
    const preferredKeys = [
      'message',
      'msg',
      'error',
      'detail',
      'details',
      'reason'
    ]
    const preferredValues = preferredKeys
      .filter((key) => key in value)
      .flatMap((key) => flattenMessage(value[key]))

    if (preferredValues.length > 0) {
      return preferredValues
    }

    return Object.entries(value).flatMap(([key, item]) => {
      const normalized = flattenMessage(item)
      if (normalized.length === 0) {
        return []
      }
      return normalized.map((text) => `${key}: ${text}`)
    })
  }

  return [String(value)]
}

const exactMessageKeyMap: Record<string, string> = {
  'unknown exception': 'common.unknown_exception',
  'unknown error': 'common.unknown_error',
  'illegal state': 'common.invalid_state',
  'datasource invalid': 'common.datasource_invalid',
  'access denied': 'common.access_denied',
  'the token is expired or invalid, please login again.': 'common.token_invalid',
  'the user name and password do not match or user is disabled, please check your input':
    'common.authentication_failed',
  'no protocol': 'common.http_url_protocol_missing',
  'only get and post methods are supported': 'common.http_get_post_only',
  'get request must not contain a body': 'common.http_get_no_body',
  'http source get request must not contain a body': 'common.http_source_get_no_body',
  'response body is not valid json': 'common.http_response_not_json',
  'response body exceeds 1mb limit': 'common.http_response_too_large',
  'encode http parameter failed': 'common.http_param_encode_failed',
  'path does not exist': 'common.path_not_exists',
  'job mode is not set': 'common.job_mode_not_set',
  'outputschema is empty, please add input plugin': 'common.output_schema_empty',
  'table name is invalid': 'common.table_name_invalid',
  'get table names failed': 'common.table_names_load_failed',
  'get database names failed': 'common.database_names_load_failed',
  'get databases failed': 'common.database_names_load_failed',
  'failed to get database names': 'common.database_names_load_failed',
  'get schemas failed': 'common.schemas_load_failed',
  'get table fields failed': 'common.table_fields_load_failed',
  'failed to get table fields': 'common.table_fields_load_failed',
  'check jdbc connectivity failed': 'common.jdbc_connectivity_check_failed',
  'jdbc connection failed': 'common.jdbc_connection_failed',
  'get dm connection failed': 'common.dm_connection_failed',
  'schedule disabled.': 'common.schedule_disabled',
  'current trigger time is outside the active window.': 'common.schedule_outside_window',
  'job definition not found.': 'common.job_definition_not_found',
  'schedule execution submission failed.': 'common.schedule_submit_failed',
  'schedule execution failed.': 'common.schedule_execution_failed',
  'schedule submitted successfully.': 'common.schedule_submitted_success',
  'network error': 'common.network_error',
  "can't delete yourself": 'common.cannot_delete_self'
}

const translatePatternMessage = (message: string): string | null => {
  const patternRules: Array<{
    pattern: RegExp
    render: (match: RegExpMatchArray) => string
  }> = [
    {
      pattern: /^Datasource invalid\.?\s*(.+)$/i,
      render: (match) =>
        joinSentence(t('common.datasource_invalid'), translateSingleMessage(match[1]))
    },
    {
      pattern: /^Unknown exception\.?\s*(.+)$/i,
      render: (match) =>
        joinSentence(t('common.unknown_exception'), translateSingleMessage(match[1]))
    },
    {
      pattern: /^illegal state\.?\s*(.+)$/i,
      render: (match) =>
        joinSentence(t('common.invalid_state'), translateSingleMessage(match[1]))
    },
    {
      pattern: /^Access denied\.?\s*(.+)$/i,
      render: (match) =>
        joinSentence(t('common.access_denied'), translateSingleMessage(match[1]))
    },
    {
      pattern: /^HTTP datasource connectivity check failed:\s*(.+)$/i,
      render: (match) =>
        joinDetail(
          t('common.http_datasource_connectivity_failed'),
          translateSingleMessage(match[1])
        )
    },
    {
      pattern: /^HTTP status (\d+) returned from (.+)$/i,
      render: (match) =>
        t('common.http_request_status', { status: match[1], url: match[2] })
    },
    {
      pattern: /^Invalid map config:\s*(.+)$/i,
      render: (match) =>
        joinDetail(
          t('common.http_map_config_invalid'),
          translateSingleMessage(match[1])
        )
    },
    {
      pattern: /^param miss \[([^\]]+)\]$/i,
      render: (match) =>
        t('common.param_missing_named', {
          param: translateParameterName(match[1])
        })
    },
    {
      pattern: /^param \[([^\]]+)\] can not be null or empty$/i,
      render: (match) =>
        t('common.param_empty_named', {
          param: translateParameterName(match[1])
        })
    },
    {
      pattern: /^param \[([^\]]+)\] is invalid\.?\s*(.*)$/i,
      render: (match) => {
        const summary = t('common.param_invalid_named', {
          param: translateParameterName(match[1])
        })
        const detail = translateSingleMessage(match[2] || '')
        return detail ? joinDetail(summary, detail) : summary
      }
    },
    {
      pattern: /^(.+?) must not be empty$/i,
      render: (match) =>
        t('common.param_empty_named', {
          param: translateParameterName(match[1])
        })
    },
    {
      pattern: /^resource \[([^\]]+)\] already exists$/i,
      render: (match) =>
        t('common.resource_already_exists_named', { name: match[1] })
    },
    {
      pattern: /^resource \[([^\]]+)\] not found$/i,
      render: (match) =>
        t('common.resource_not_found_named', { name: match[1] })
    },
    {
      pattern: /^datasource \[([^\]]+)\] already exists$/i,
      render: (match) =>
        t('common.datasource_exists_named', { name: match[1] })
    },
    {
      pattern: /^datasource \[([^\]]+)\] not found$/i,
      render: (match) =>
        t('common.datasource_not_found_named', { name: match[1] })
    },
    {
      pattern: /^datasource \[([^\]]+)\] not exists$/i,
      render: (match) =>
        t('common.datasource_not_exists_named', { name: match[1] })
    },
    {
      pattern: /^virtual table \[([^\]]+)\] already exists$/i,
      render: (match) =>
        t('common.virtual_table_exists_named', { name: match[1] })
    },
    {
      pattern: /^task \[([^\]]+)\] already exists$/i,
      render: (match) => t('common.task_exists_named', { name: match[1] })
    },
    {
      pattern: /^database not found: (.+)$/i,
      render: (match) =>
        t('common.database_not_found_named', { name: match[1] })
    },
    {
      pattern: /^table not found: (.+)$/i,
      render: (match) => t('common.table_not_found_named', { name: match[1] })
    },
    {
      pattern: /^(?:DM|DB2|[A-Za-z0-9_-]+) jdbc driver (.+) not found$/i,
      render: (match) => t('common.driver_not_found_named', { name: match[1] })
    },
    {
      pattern: /^No value found for placeholder: \[([^\]]+)\]$/i,
      render: (match) =>
        t('common.no_value_for_placeholder', { name: match[1] })
    },
    {
      pattern: /^invalid operation \[([^\]]+)\]$/i,
      render: (match) =>
        t('common.invalid_operation_named', { name: match[1] })
    },
    {
      pattern: /^unsupported engine \[([^\]]+)\] version \[([^\]]+)\]$/i,
      render: (match) =>
        t('common.unsupported_engine_named', {
          name: match[1],
          version: match[2]
        })
    },
    {
      pattern: /^unsupported connector type \[([^\]]+)\].*$/i,
      render: (match) =>
        t('common.unsupported_connector_type_named', { name: match[1] })
    },
    {
      pattern: /^Invalid authentication provider \[([^\]]+)\]$/i,
      render: (match) =>
        t('common.invalid_authentication_provider_named', { name: match[1] })
    },
    {
      pattern: /^Created job instance #(\d+)$/i,
      render: (match) => t('common.schedule_created_instance', { id: match[1] })
    },
    {
      pattern: /^Request failed with status code (\d+)$/i,
      render: (match) => {
        if (match[1] === '404') {
          return t('common.resource_not_found')
        }
        if (match[1] === '403') {
          return t('common.access_denied')
        }
        return t('common.request_failed_with_status', { status: match[1] })
      }
    }
  ]

  const matchedRule = patternRules.find((rule) => rule.pattern.test(message))
  if (!matchedRule) {
    return null
  }
  const matched = message.match(matchedRule.pattern)
  return matched ? matchedRule.render(matched) : null
}

const translateSingleMessage = (message: string) => {
  const normalizedMessage = normalizeMessageText(message)
  if (!normalizedMessage || containsChinese.test(normalizedMessage)) {
    return normalizedMessage
  }

  const exactMessageKey = exactMessageKeyMap[normalizedMessage.toLowerCase()]
  if (exactMessageKey) {
    return t(exactMessageKey)
  }

  const patternTranslation = translatePatternMessage(normalizedMessage)
  if (patternTranslation) {
    return patternTranslation
  }

  const lowerMessage = normalizedMessage.toLowerCase()
  if (lowerMessage.includes('connection refused')) {
    return t('common.connection_refused')
  }
  if (
    lowerMessage.includes('connect timed out') ||
    lowerMessage.includes('read timed out') ||
    lowerMessage.includes('connection timed out')
  ) {
    return t('common.connection_timeout')
  }
  if (lowerMessage.includes('connection reset')) {
    return t('common.connection_reset')
  }
  if (lowerMessage.includes('unknown host')) {
    return t('common.unknown_host')
  }
  if (
    lowerMessage.includes('access denied for user') ||
    lowerMessage.includes('authentication failed')
  ) {
    return t('common.authentication_failed')
  }
  if (lowerMessage.includes('public key retrieval is not allowed')) {
    return t('common.public_key_retrieval_not_allowed')
  }
  if (lowerMessage.includes('communications link failure')) {
    return t('common.database_connection_failed')
  }

  return normalizedMessage
}

export const formatMessagePayload = (payload: unknown) => {
  const lines = flattenMessage(payload)
  if (lines.length === 0) {
    return t('common.unknown_error')
  }
  return lines
    .map((line) => translateSingleMessage(line))
    .filter((line) => line.trim())
    .join('\n')
}

export const translateMessage = (payload: unknown) => {
  return formatMessagePayload(payload)
}

export const createPersistentErrorMessage = (messageApi: MessageApi) => {
  return new Proxy(messageApi, {
    get(target, property, receiver) {
      if (property === 'error') {
        return (content: MessageContent, options?: MessageOptions) =>
          target.error(content, {
            ...PERSISTENT_ERROR_OPTIONS,
            ...(options || {})
          })
      }

      const value = Reflect.get(target, property, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    }
  }) as MessageApi
}

export const usePersistentErrorMessage = () => {
  return createPersistentErrorMessage(useMessage())
}

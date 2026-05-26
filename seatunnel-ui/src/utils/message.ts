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

type MessageApi = ReturnType<typeof useMessage>
type MessageContent = Parameters<MessageApi['error']>[0]
type MessageOptions = Parameters<MessageApi['error']>[1]

const PERSISTENT_ERROR_OPTIONS = {
  closable: true,
  duration: 0
} satisfies NonNullable<MessageOptions>

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

export const formatMessagePayload = (payload: unknown) => {
  const lines = flattenMessage(payload)
  return lines.length > 0 ? lines.join('\n') : 'Unknown error'
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

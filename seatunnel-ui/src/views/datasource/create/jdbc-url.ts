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

const JDBC_MYSQL_PLUGIN_NAME = 'JDBC-Mysql'
const JDBC_ORACLE_PLUGIN_NAME = 'JDBC-Oracle'
const JDBC_DM_PLUGIN_NAME = 'JDBC-DM'
const JDBC_POSTGRES_PLUGIN_NAME = 'JDBC-Postgres'
const JDBC_SQLSERVER_PLUGIN_NAME = 'JDBC-SQLServer'
const JDBC_DB2_PLUGIN_NAME = 'JDBC-Db2'

export const JDBC_HOST_FIELD = 'jdbcHost'
export const JDBC_PORT_FIELD = 'jdbcPort'
export const JDBC_DATABASE_FIELD = 'jdbcDatabase'
export const JDBC_URL_PARAMS_FIELD = 'jdbcUrlParams'

const JDBC_SUPPORTED_PLUGINS = new Set([
  JDBC_MYSQL_PLUGIN_NAME,
  JDBC_ORACLE_PLUGIN_NAME,
  JDBC_DM_PLUGIN_NAME,
  JDBC_POSTGRES_PLUGIN_NAME,
  JDBC_SQLSERVER_PLUGIN_NAME,
  JDBC_DB2_PLUGIN_NAME
])

const trimValue = (value: any) => String(value || '').trim()

const appendParams = (base: string, params: string) => {
  const normalized = trimValue(params).replace(/^[?;&]+/, '')
  if (!normalized) return base
  if (base.includes('?')) return `${base}&${normalized}`
  return `${base}?${normalized}`
}

export const isJdbcPlugin = (pluginName: string) =>
  JDBC_SUPPORTED_PLUGINS.has(trimValue(pluginName))

export const buildJdbcUrlByPlugin = (
  pluginName: string,
  host: string,
  port: string,
  database: string,
  urlParams: string
) => {
  const normalizedPlugin = trimValue(pluginName)
  const normalizedHost = trimValue(host)
  const normalizedPort = trimValue(port)
  const normalizedDatabase = trimValue(database)

  if (!normalizedHost || !normalizedPort) return ''

  if (normalizedPlugin === JDBC_MYSQL_PLUGIN_NAME) {
    const base = normalizedDatabase
      ? `jdbc:mysql://${normalizedHost}:${normalizedPort}/${normalizedDatabase}`
      : `jdbc:mysql://${normalizedHost}:${normalizedPort}`
    return appendParams(
      base,
      urlParams
    )
  }
  if (normalizedPlugin === JDBC_ORACLE_PLUGIN_NAME) {
    const base = normalizedDatabase
      ? `jdbc:oracle:thin:@${normalizedHost}:${normalizedPort}:${normalizedDatabase}`
      : `jdbc:oracle:thin:@${normalizedHost}:${normalizedPort}`
    return appendParams(
      base,
      urlParams
    )
  }
  if (normalizedPlugin === JDBC_DM_PLUGIN_NAME) {
    const base = normalizedDatabase
      ? `jdbc:dm://${normalizedHost}:${normalizedPort}/${normalizedDatabase}`
      : `jdbc:dm://${normalizedHost}:${normalizedPort}`
    return appendParams(base, urlParams)
  }
  if (normalizedPlugin === JDBC_POSTGRES_PLUGIN_NAME) {
    const base = normalizedDatabase
      ? `jdbc:postgresql://${normalizedHost}:${normalizedPort}/${normalizedDatabase}`
      : `jdbc:postgresql://${normalizedHost}:${normalizedPort}`
    return appendParams(
      base,
      urlParams
    )
  }
  if (normalizedPlugin === JDBC_SQLSERVER_PLUGIN_NAME) {
    const base = normalizedDatabase
      ? `jdbc:sqlserver://${normalizedHost}:${normalizedPort};database=${normalizedDatabase}`
      : `jdbc:sqlserver://${normalizedHost}:${normalizedPort}`
    const normalized = trimValue(urlParams).replace(/^[?;&]+/, '')
    return normalized ? `${base};${normalized}` : base
  }
  if (normalizedPlugin === JDBC_DB2_PLUGIN_NAME) {
    const base = normalizedDatabase
      ? `jdbc:db2://${normalizedHost}:${normalizedPort}/${normalizedDatabase}`
      : `jdbc:db2://${normalizedHost}:${normalizedPort}`
    return appendParams(
      base,
      urlParams
    )
  }
  return ''
}

const decodeUrlParams = (value: string) => trimValue(value).replace(/^[?;&]+/, '')

export const parseJdbcUrlByPlugin = (
  pluginName: string,
  url: string
): Record<string, string> => {
  const normalizedPlugin = trimValue(pluginName)
  const normalizedUrl = trimValue(url)
  if (!normalizedUrl) {
    return {
      [JDBC_HOST_FIELD]: '',
      [JDBC_PORT_FIELD]: '',
      [JDBC_DATABASE_FIELD]: '',
      [JDBC_URL_PARAMS_FIELD]: ''
    }
  }

  const fallback = {
    [JDBC_HOST_FIELD]: '',
    [JDBC_PORT_FIELD]: '',
    [JDBC_DATABASE_FIELD]: '',
    [JDBC_URL_PARAMS_FIELD]: ''
  }

  if (normalizedPlugin === JDBC_MYSQL_PLUGIN_NAME) {
    const match = normalizedUrl.match(/^jdbc:mysql:\/\/([^:/?#]+):(\d+)(?:\/([^?;#]*))?(?:\?(.*))?$/i)
    return match
      ? {
          [JDBC_HOST_FIELD]: match[1] || '',
          [JDBC_PORT_FIELD]: match[2] || '',
          [JDBC_DATABASE_FIELD]: match[3] || '',
          [JDBC_URL_PARAMS_FIELD]: decodeUrlParams(match[4] || '')
        }
      : fallback
  }
  if (normalizedPlugin === JDBC_ORACLE_PLUGIN_NAME) {
    const sidMatch = normalizedUrl.match(/^jdbc:oracle:thin:@([^:/?#]+):(\d+):([^?;#]+)(?:\?(.*))?$/i)
    if (sidMatch) {
      return {
        [JDBC_HOST_FIELD]: sidMatch[1] || '',
        [JDBC_PORT_FIELD]: sidMatch[2] || '',
        [JDBC_DATABASE_FIELD]: sidMatch[3] || '',
        [JDBC_URL_PARAMS_FIELD]: decodeUrlParams(sidMatch[4] || '')
      }
    }
    const serviceNameMatch = normalizedUrl.match(
      /^jdbc:oracle:thin:@\/\/([^:/?#]+):(\d+)\/([^?;#]+)(?:\?(.*))?$/i
    )
    const hostPortMatch = normalizedUrl.match(/^jdbc:oracle:thin:@([^:/?#]+):(\d+)(?:\?(.*))?$/i)
    if (serviceNameMatch) {
      return {
        [JDBC_HOST_FIELD]: serviceNameMatch[1] || '',
        [JDBC_PORT_FIELD]: serviceNameMatch[2] || '',
        [JDBC_DATABASE_FIELD]: serviceNameMatch[3] || '',
        [JDBC_URL_PARAMS_FIELD]: decodeUrlParams(serviceNameMatch[4] || '')
      }
    }
    if (hostPortMatch) {
      return {
        [JDBC_HOST_FIELD]: hostPortMatch[1] || '',
        [JDBC_PORT_FIELD]: hostPortMatch[2] || '',
        [JDBC_DATABASE_FIELD]: '',
        [JDBC_URL_PARAMS_FIELD]: decodeUrlParams(hostPortMatch[3] || '')
      }
    }
    return fallback
  }
  if (normalizedPlugin === JDBC_DM_PLUGIN_NAME) {
    const match = normalizedUrl.match(/^jdbc:dm:\/\/([^:/?#]+):(\d+)(?:\/([^?;#]*))?(?:\?(.*))?$/i)
    return match
      ? {
          [JDBC_HOST_FIELD]: match[1] || '',
          [JDBC_PORT_FIELD]: match[2] || '',
          [JDBC_DATABASE_FIELD]: match[3] || '',
          [JDBC_URL_PARAMS_FIELD]: decodeUrlParams(match[4] || '')
        }
      : fallback
  }
  if (normalizedPlugin === JDBC_POSTGRES_PLUGIN_NAME) {
    const match = normalizedUrl.match(
      /^jdbc:postgresql:\/\/([^:/?#]+):(\d+)(?:\/([^?;#]*))?(?:\?(.*))?$/i
    )
    return match
      ? {
          [JDBC_HOST_FIELD]: match[1] || '',
          [JDBC_PORT_FIELD]: match[2] || '',
          [JDBC_DATABASE_FIELD]: match[3] || '',
          [JDBC_URL_PARAMS_FIELD]: decodeUrlParams(match[4] || '')
        }
      : fallback
  }
  if (normalizedPlugin === JDBC_SQLSERVER_PLUGIN_NAME) {
    const match = normalizedUrl.match(/^jdbc:sqlserver:\/\/([^:/?#]+):(\d+)(?:;(.*))?$/i)
    if (!match) return fallback
    const tail = trimValue(match[3] || '')
    const parts = tail ? tail.split(';').filter(Boolean) : []
    const databasePart = parts.find((item) => /^database=/i.test(item)) || ''
    const urlParams = parts.filter((item) => !/^database=/i.test(item)).join(';')
    return {
      [JDBC_HOST_FIELD]: match[1] || '',
      [JDBC_PORT_FIELD]: match[2] || '',
      [JDBC_DATABASE_FIELD]: databasePart.replace(/^database=/i, ''),
      [JDBC_URL_PARAMS_FIELD]: decodeUrlParams(urlParams)
    }
  }
  if (normalizedPlugin === JDBC_DB2_PLUGIN_NAME) {
    const match = normalizedUrl.match(/^jdbc:db2:\/\/([^:/?#]+):(\d+)(?:\/([^?;#]*))?(?:\?(.*))?$/i)
    return match
      ? {
          [JDBC_HOST_FIELD]: match[1] || '',
          [JDBC_PORT_FIELD]: match[2] || '',
          [JDBC_DATABASE_FIELD]: match[3] || '',
          [JDBC_URL_PARAMS_FIELD]: decodeUrlParams(match[4] || '')
        }
      : fallback
  }

  return fallback
}

export const getJdbcFieldHintByPlugin = (pluginName: string) => {
  const normalizedPlugin = trimValue(pluginName)
  if (normalizedPlugin === JDBC_ORACLE_PLUGIN_NAME) {
    return {
      databasePlaceholder: 'service_name/SID',
      paramsPlaceholder: 'oracle.net.CONNECT_TIMEOUT=5000',
      urlExample: 'jdbc:oracle:thin:@127.0.0.1:1521:orcl'
    }
  }
  if (normalizedPlugin === JDBC_DM_PLUGIN_NAME) {
    return {
      databasePlaceholder: 'database(optional)',
      paramsPlaceholder: 'compatibleMode=mysql',
      urlExample: 'jdbc:dm://127.0.0.1:5236'
    }
  }
  if (normalizedPlugin === JDBC_SQLSERVER_PLUGIN_NAME) {
    return {
      databasePlaceholder: 'database',
      paramsPlaceholder: 'encrypt=false;trustServerCertificate=true',
      urlExample: 'jdbc:sqlserver://127.0.0.1:1433;database=test'
    }
  }
  if (normalizedPlugin === JDBC_POSTGRES_PLUGIN_NAME) {
    return {
      databasePlaceholder: 'database',
      paramsPlaceholder: 'sslmode=disable&currentSchema=public',
      urlExample: 'jdbc:postgresql://127.0.0.1:5432/test'
    }
  }
  if (normalizedPlugin === JDBC_DB2_PLUGIN_NAME) {
    return {
      databasePlaceholder: 'database',
      paramsPlaceholder: 'retrieveMessagesFromServerOnGetMessage=true',
      urlExample: 'jdbc:db2://127.0.0.1:50000/test'
    }
  }
  return {
    databasePlaceholder: 'database',
    paramsPlaceholder: 'useSSL=false&serverTimezone=UTC',
    urlExample: 'jdbc:mysql://127.0.0.1:3306/test'
  }
}

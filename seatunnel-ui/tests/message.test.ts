/*
 * @author: zhjj
 */

import i18n from '../src/locales'
import { translateMessage } from '../src/utils/message'

describe('translateMessage', () => {
  afterEach(() => {
    i18n.global.locale.value = 'zh_CN'
  })

  it('translates datasource connectivity errors to chinese by default', () => {
    expect(
      translateMessage(
        'Datasource invalid. HTTP datasource connectivity check failed: no protocol'
      )
    ).toBe('数据源校验失败。HTTP 数据源连通性校验失败：URL 缺少协议，请填写 http:// 或 https://')
  })

  it('translates parameter validation errors to chinese', () => {
    expect(translateMessage('param [jobDefineId] can not be null or empty')).toBe(
      '参数【任务定义 ID】不能为空'
    )
  })

  it('keeps english capability when locale is en_US', () => {
    i18n.global.locale.value = 'en_US'

    expect(
      translateMessage(
        'Datasource invalid. HTTP datasource connectivity check failed: no protocol'
      )
    ).toBe(
      'Datasource is invalid. HTTP datasource connectivity check failed: URL is missing the protocol. Please use http:// or https://'
    )
  })

  it('keeps chinese messages unchanged', () => {
    expect(translateMessage('路径不存在')).toBe('路径不存在')
  })
})

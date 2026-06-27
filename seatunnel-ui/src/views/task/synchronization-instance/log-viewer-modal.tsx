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

import { defineComponent, PropType, ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NSelect,
  NSpace,
  NSpin,
  NButton,
  NEmpty,
  NAlert,
  NSwitch,
  NInput,
  NInputGroup,
  NTag,
  NTooltip
} from 'naive-ui'
import { getLogNodes, getLogContent } from '@/service/log'
import type { LogNode } from '@/service/log/types'
import { translateMessage } from '@/utils/message'
import styles from './log-viewer-modal.module.scss'

const LogViewerModal = defineComponent({
  name: 'LogViewerModal',
  props: {
    show: {
      type: Boolean as PropType<boolean>,
      default: false
    },
    jobId: {
      type: [String, Number] as PropType<string | number>,
      default: ''
    },
    jobName: {
      type: String as PropType<string>,
      default: ''
    }
  },
  emits: ['update:show'],
  setup(props) {
    const { t } = useI18n()

    const logNodes = ref<LogNode[]>([])
    const selectedLogNode = ref('')
    const logContent = ref('')
    const loading = ref(false)
    const loadingLogs = ref(false)
    const refreshInterval = ref(0)
    const autoScroll = ref(false)
    const logContentRef = ref<HTMLElement | null>(null)
    const error = ref('')
    const refreshTimerId = ref<number | null>(null)
    const userScrolled = ref(false)
    
    // 搜索相关状态
    const searchKeyword = ref('')
    const caseSensitive = ref(false)
    const currentMatchIndex = ref(0)
    const matchedLines = ref<number[]>([])
    
    // 高亮关键字配置
    const highlightKeywords = ref<string[]>(['ERROR', 'WARN', 'Exception', 'Failed'])

    const refreshIntervalOptions = [
      { label: t('project.synchronization_instance.refresh_off'), value: 0 },
      { label: t('project.synchronization_instance.refresh_1s'), value: 1 },
      { label: t('project.synchronization_instance.refresh_5s'), value: 5 },
      { label: t('project.synchronization_instance.refresh_10s'), value: 10 },
      { label: t('project.synchronization_instance.refresh_30s'), value: 30 },
      { label: t('project.synchronization_instance.refresh_60s'), value: 60 }
    ]
    
    // 计算搜索匹配数量
    const matchCount = computed(() => matchedLines.value.length)
    
    // 处理日志内容高亮
    const highlightedLogContent = computed(() => {
      if (!logContent.value) return ''
      
      let content = logContent.value
      const lines = content.split('\n')
      const highlightedLines = lines.map((line, index) => {
        let highlightedLine = line
        
        // 高亮预设关键字（ERROR, WARN等）
        highlightKeywords.value.forEach(keyword => {
          const regex = new RegExp(`(${keyword})`, 'gi')
          highlightedLine = highlightedLine.replace(regex, '<span class="log-keyword-highlight">$1</span>')
        })
        
        // 高亮搜索关键字
        if (searchKeyword.value) {
          const searchRegex = caseSensitive.value 
            ? new RegExp(`(${escapeRegex(searchKeyword.value)})`, 'g')
            : new RegExp(`(${escapeRegex(searchKeyword.value)})`, 'gi')
          
          if (searchRegex.test(line)) {
            const isCurrentMatch = matchedLines.value[currentMatchIndex.value] === index
            const highlightClass = isCurrentMatch ? 'log-search-highlight-current' : 'log-search-highlight'
            highlightedLine = highlightedLine.replace(searchRegex, `<span class="${highlightClass}">$1</span>`)
          }
        }
        
        return highlightedLine
      })
      
      return highlightedLines.join('\n')
    })
    
    // 转义正则表达式特殊字符
    const escapeRegex = (str: string) => {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    const resetLogState = () => {
      logNodes.value = []
      selectedLogNode.value = ''
      logContent.value = ''
      loading.value = false
      loadingLogs.value = false
      error.value = ''
      userScrolled.value = false
      searchKeyword.value = ''
      currentMatchIndex.value = 0
      matchedLines.value = []
    }

    const normalizeLogNodes = (payload: any): LogNode[] => {
      if (Array.isArray(payload)) return payload
      if (Array.isArray(payload?.data)) return payload.data
      if (Array.isArray(payload?.logs)) return payload.logs
      if (Array.isArray(payload?.items)) return payload.items
      return []
    }

    const normalizeLogContent = (payload: any): string => {
      const content = payload?.data ?? payload?.logContent ?? payload?.content ?? payload

      if (content === undefined || content === null) {
        return ''
      }

      if (typeof content === 'string') {
        return content
      }

      if (typeof content === 'object') {
        return JSON.stringify(content, null, 2)
      }

      return String(content)
    }

    const fetchLogNodes = async () => {
      if (!props.jobId) return

      loading.value = true
      error.value = ''

      try {
        const response = await getLogNodes(props.jobId)
        logNodes.value = normalizeLogNodes(response?.data)

        if (logNodes.value.length > 0) {
          selectedLogNode.value = logNodes.value[0].logLink
        } else {
          loading.value = false
          logContent.value = ''
        }
      } catch (err: any) {
        console.error('Error fetching log nodes:', err)
        error.value = translateMessage(
          err.message || t('project.synchronization_instance.fetch_logs_error')
        )
        loading.value = false
      }
    }

    const fetchLogContent = async () => {
      if (!selectedLogNode.value) return

      loadingLogs.value = true
      error.value = ''

      try {
        const response = await getLogContent(selectedLogNode.value)

        const newContent = normalizeLogContent(response?.data)

        if (newContent !== logContent.value) {
          logContent.value = newContent

          if (autoScroll.value && !userScrolled.value) {
            scrollToBottom()
          }
        }

        loading.value = false
        loadingLogs.value = false
      } catch (err: any) {
        console.error('Error fetching log content:', err)
        error.value = translateMessage(
          err.message || t('project.synchronization_instance.fetch_log_content_error')
        )
        loading.value = false
        loadingLogs.value = false
      }
    }

    const scrollToBottom = () => {
      nextTick(() => {
        if (logContentRef.value) {
          logContentRef.value.scrollTop = logContentRef.value.scrollHeight
        }
      })
    }

    const setupRefreshInterval = () => {
      clearRefreshTimer()

      if (refreshInterval.value > 0) {
        refreshTimerId.value = window.setInterval(() => {
          fetchLogContent()
        }, refreshInterval.value * 1000)
      }
    }

    const clearRefreshTimer = () => {
      if (refreshTimerId.value !== null) {
        clearInterval(refreshTimerId.value)
        refreshTimerId.value = null
      }
    }

    const handleRefresh = () => {
      fetchLogContent()
    }

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement
      const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 10

      userScrolled.value = !isAtBottom
    }
    
    // 搜索功能
    const handleSearch = () => {
      if (!searchKeyword.value || !logContent.value) {
        matchedLines.value = []
        currentMatchIndex.value = 0
        return
      }
      
      const lines = logContent.value.split('\n')
      const matches: number[] = []
      const searchRegex = caseSensitive.value 
        ? new RegExp(escapeRegex(searchKeyword.value), 'g')
        : new RegExp(escapeRegex(searchKeyword.value), 'gi')
      
      lines.forEach((line, index) => {
        if (searchRegex.test(line)) {
          matches.push(index)
        }
      })
      
      matchedLines.value = matches
      currentMatchIndex.value = 0
      
      if (matches.length > 0) {
        scrollToLine(matches[0])
      }
    }
    
    // 上一个匹配
    const handlePrevMatch = () => {
      if (matchedLines.value.length === 0) return
      
      currentMatchIndex.value = (currentMatchIndex.value - 1 + matchedLines.value.length) % matchedLines.value.length
      scrollToLine(matchedLines.value[currentMatchIndex.value])
    }
    
    // 下一个匹配
    const handleNextMatch = () => {
      if (matchedLines.value.length === 0) return
      
      currentMatchIndex.value = (currentMatchIndex.value + 1) % matchedLines.value.length
      scrollToLine(matchedLines.value[currentMatchIndex.value])
    }
    
    // 滚动到指定行
    const scrollToLine = (lineNumber: number) => {
      nextTick(() => {
        if (logContentRef.value) {
          const lineHeight = 21 // 1.5 * 14px font-size
          const scrollPosition = lineNumber * lineHeight - logContentRef.value.clientHeight / 2
          logContentRef.value.scrollTop = Math.max(0, scrollPosition)
        }
      })
    }
    
    // 下载日志
    const handleDownload = () => {
      if (!logContent.value) {
        window.$message.warning(t('project.synchronization_instance.no_log_content'))
        return
      }
      
      const blob = new Blob([logContent.value], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${props.jobName || props.jobId}_${selectedLogNode.value.split('/').pop() || 'log'}.txt`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      window.$message.success(t('project.synchronization_instance.download_success'))
    }
    
    // 清空搜索
    const handleClearSearch = () => {
      searchKeyword.value = ''
      matchedLines.value = []
      currentMatchIndex.value = 0
    }

    watch(() => selectedLogNode.value, (newValue, oldValue) => {
      if (!newValue || newValue === oldValue) {
        return
      }

      logContent.value = ''
      void fetchLogContent()
    })

    watch(() => refreshInterval.value, () => {
      setupRefreshInterval()
    })

    watch(() => props.show, (newVal) => {
      if (newVal) {
        resetLogState()
        void fetchLogNodes()
        setupRefreshInterval()
      } else {
        clearRefreshTimer()
        resetLogState()
      }
    })

    watch(() => props.jobId, (newJobId, oldJobId) => {
      if (props.show && newJobId && newJobId !== oldJobId) {
        resetLogState()
        void fetchLogNodes()
      }
    })

    onMounted(() => {
      if (props.show) {
        void fetchLogNodes()
        setupRefreshInterval()
      }
    })

    onUnmounted(() => {
      clearRefreshTimer()
    })

    return {
      t,
      logNodes,
      selectedLogNode,
      logContent,
      loading,
      loadingLogs,
      refreshInterval,
      autoScroll,
      logContentRef,
      error,
      refreshIntervalOptions,
      userScrolled,
      handleRefresh,
      handleScroll,
      scrollToBottom,
      searchKeyword,
      caseSensitive,
      currentMatchIndex,
      matchedLines,
      matchCount,
      highlightedLogContent,
      handleSearch,
      handlePrevMatch,
      handleNextMatch,
      handleDownload,
      handleClearSearch
    }
  },
  render() {
    const { t } = this

    return (
      <NModal
        show={this.show}
        onUpdateShow={(v: boolean) => this.$emit('update:show', v)}
        title={t('project.synchronization_instance.view_logs') + (this.jobName ? `: ${this.jobName}` : '')}
        style="width: 90%; max-width: 1600px;"
        preset="card"
      >
        <NSpace vertical size="large">
          {this.error && (
            <NAlert type="error" closable>
              {this.error}
            </NAlert>
          )}
          
          <div class={styles['control-panel']}>
            <div class={styles['control-group']}>
              <label class={styles['control-label']}>{t('project.synchronization_instance.log_node')}:</label>
              <NSelect
                v-model:value={this.selectedLogNode}
                options={this.logNodes.map(node => ({
                  label: node.node + ' - ' + node.logName,
                  value: node.logLink
                }))}
                style="min-width: 300px;"
                loading={this.loading}
                disabled={this.loading || this.logNodes.length === 0}
              />
            </div>
            
            <div class={styles['control-group']}>
              <div class={styles['control-item']}>
                <label class={styles['control-label']}>{t('project.synchronization_instance.auto_scroll')}:</label>
                <NSwitch v-model:value={this.autoScroll} />
              </div>
              <div class={styles['control-item']}>
                <label class={styles['control-label']}>{t('project.synchronization_instance.auto_refresh')}:</label>
                <NSelect
                  v-model:value={this.refreshInterval}
                  options={this.refreshIntervalOptions}
                  style="min-width: 120px;"
                />
              </div>
              <NButton onClick={this.handleRefresh} loading={this.loadingLogs} class={styles['refresh-button']}>
                {t('project.synchronization_instance.refresh')}
              </NButton>
              <NButton onClick={this.handleDownload} disabled={!this.logContent} class={styles['download-button']}>
                <span class="iconify" data-icon="material-symbols:download" style="margin-right: 4px;" />
                {t('project.synchronization_instance.download_log')}
              </NButton>
            </div>
          </div>
          
          {/* 搜索栏 */}
          <div class={styles['search-panel']}>
            <NInputGroup>
              <NInput
                v-model:value={this.searchKeyword}
                placeholder={t('project.synchronization_instance.search_placeholder')}
                onKeyup={(e: KeyboardEvent) => e.key === 'Enter' && this.handleSearch()}
                style="flex: 1;"
              >
                {{
                  suffix: () => (
                    this.searchKeyword && (
                      <span
                        class="iconify"
                        data-icon="material-symbols:close"
                        style="cursor: pointer; color: #999;"
                        onClick={this.handleClearSearch}
                      />
                    )
                  )
                }}
              </NInput>
              <NTooltip trigger="hover">
                {{
                  trigger: () => (
                    <NButton
                      onClick={() => this.caseSensitive = !this.caseSensitive}
                      type={this.caseSensitive ? 'primary' : 'default'}
                      style="width: 40px;"
                    >
                      Aa
                    </NButton>
                  ),
                  default: () => t('project.synchronization_instance.case_sensitive')
                }}
              </NTooltip>
              <NButton onClick={this.handleSearch} type="primary">
                <span class="iconify" data-icon="material-symbols:search" />
              </NButton>
            </NInputGroup>
            
            {this.matchCount > 0 && (
              <div class={styles['search-result']}>
                <NTag size="small" type="info">
                  {this.currentMatchIndex + 1} / {this.matchCount}
                </NTag>
                <NButton size="small" onClick={this.handlePrevMatch} disabled={this.matchCount === 0}>
                  <span class="iconify" data-icon="material-symbols:keyboard-arrow-up" />
                </NButton>
                <NButton size="small" onClick={this.handleNextMatch} disabled={this.matchCount === 0}>
                  <span class="iconify" data-icon="material-symbols:keyboard-arrow-down" />
                </NButton>
              </div>
            )}
          </div>
          
          <div class={styles['log-content-container']}>
            {this.loading ? (
              <div class={styles['loading-container']}>
                <NSpin size="large" />
              </div>
            ) : this.logNodes.length === 0 ? (
              <NEmpty description={t('project.synchronization_instance.no_logs_available')} />
            ) : (
              <div class={styles['log-content-wrapper']}>
                <div
                  class={styles['log-content']}
                  ref="logContentRef"
                  onScroll={this.handleScroll}
                >
                  <pre innerHTML={this.highlightedLogContent || t('project.synchronization_instance.no_log_content')}></pre>
                  {this.userScrolled && this.autoScroll && (
                    <div
                      style="position: absolute; bottom: 20px; right: 20px; background: rgba(0,0,0,0.6); color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer;"
                      onClick={this.scrollToBottom}
                    >
                      {t('project.synchronization_instance.scroll_to_bottom')}
                    </div>
                  )}
                </div>
                {this.loadingLogs && (
                  <div class={styles['log-loading-overlay']}>
                    <NSpin size="large" />
                  </div>
                )}
              </div>
            )}
          </div>
        </NSpace>
      </NModal>
    )
  }
})

export default LogViewerModal

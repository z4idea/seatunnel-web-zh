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

import { defineComponent, PropType, ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NProgress,
  NSpace,
  NSpin,
  NStatistic,
  NGrid,
  NGridItem,
  NCard,
  NAlert,
  NButton,
  NIcon
} from 'naive-ui'
import { queryJobExecutionDetail } from '@/service/sync-task-instance'
import { translateMessage } from '@/utils/message'
import styles from './task-progress-monitor.module.scss'

interface TaskMetrics {
  readRowCount: number
  writeRowCount: number
  readRate: number
  writeRate: number
  duration: number
  status: string
  errorMessage?: string
}

const TaskProgressMonitor = defineComponent({
  name: 'TaskProgressMonitor',
  props: {
    show: {
      type: Boolean as PropType<boolean>,
      default: false
    },
    jobInstanceId: {
      type: [String, Number] as PropType<string | number>,
      required: true
    },
    jobName: {
      type: String as PropType<string>,
      default: ''
    }
  },
  emits: ['update:show'],
  setup(props, { emit }) {
    const { t } = useI18n()
    
    const loading = ref(false)
    const metrics = ref<TaskMetrics>({
      readRowCount: 0,
      writeRowCount: 0,
      readRate: 0,
      writeRate: 0,
      duration: 0,
      status: 'RUNNING'
    })
    
    const refreshTimerId = ref<number | null>(null)
    const startTime = ref<number>(Date.now())
    
    // 计算进度百分比（基于读写比例）
    const progressPercent = computed(() => {
      if (metrics.value.readRowCount === 0) return 0
      const percent = (metrics.value.writeRowCount / metrics.value.readRowCount) * 100
      return Math.min(Math.round(percent), 100)
    })
    
    // 格式化数字
    const formatNumber = (num: number): string => {
      if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M'
      } else if (num >= 1000) {
        return (num / 1000).toFixed(2) + 'K'
      }
      return num.toString()
    }
    
    // 格式化时长
    const formatDuration = (seconds: number): string => {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      const secs = seconds % 60
      
      if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`
      } else if (minutes > 0) {
        return `${minutes}m ${secs}s`
      }
      return `${secs}s`
    }
    
    // 获取任务执行详情
    const fetchTaskMetrics = async () => {
      if (!props.jobInstanceId) return
      
      try {
        const response = await queryJobExecutionDetail({
          jobInstanceId: props.jobInstanceId
        })
        
        if (response && response.data) {
          const data = response.data
          metrics.value = {
            readRowCount: data.readRowCount || 0,
            writeRowCount: data.writeRowCount || 0,
            readRate: data.sourceReceivedCount || 0,
            writeRate: data.sinkWriteCount || 0,
            duration: Math.floor((Date.now() - startTime.value) / 1000),
            status: data.jobStatus || 'RUNNING',
            errorMessage: data.errorMsg
          }
          
          // 如果任务已完成或失败，停止刷新
          if (['FINISHED', 'COMPLETED', 'SUCCESS', 'FAILED', 'ERROR', 'CANCELED', 'KILLED'].includes(metrics.value.status)) {
            clearRefreshTimer()
          }
        }
      } catch (err: any) {
        console.error('Error fetching task metrics:', err)
      }
    }
    
    // 设置定时刷新
    const setupRefreshInterval = () => {
      clearRefreshTimer()
      refreshTimerId.value = window.setInterval(() => {
        fetchTaskMetrics()
      }, 2000) // 每2秒刷新一次
    }
    
    // 清除定时器
    const clearRefreshTimer = () => {
      if (refreshTimerId.value !== null) {
        clearInterval(refreshTimerId.value)
        refreshTimerId.value = null
      }
    }
    
    // 手动刷新
    const handleRefresh = () => {
      fetchTaskMetrics()
    }
    
    // 关闭弹窗
    const handleClose = () => {
      emit('update:show', false)
    }
    
    watch(() => props.show, (newVal) => {
      if (newVal) {
        startTime.value = Date.now()
        loading.value = true
        fetchTaskMetrics().then(() => {
          loading.value = false
        })
        setupRefreshInterval()
      } else {
        clearRefreshTimer()
      }
    })
    
    onMounted(() => {
      if (props.show) {
        fetchTaskMetrics()
        setupRefreshInterval()
      }
    })
    
    onUnmounted(() => {
      clearRefreshTimer()
    })
    
    return {
      t,
      loading,
      metrics,
      progressPercent,
      formatNumber,
      formatDuration,
      handleRefresh,
      handleClose
    }
  },
  render() {
    const { t } = this
    
    return (
      <NModal
        show={this.show}
        onUpdateShow={(v: boolean) => this.$emit('update:show', v)}
        title={t('project.synchronization_instance.task_progress') + (this.jobName ? `: ${this.jobName}` : '')}
        style="width: 800px;"
        preset="card"
      >
        <NSpin show={this.loading}>
          <NSpace vertical size="large">
            {this.metrics.errorMessage && (
              <NAlert type="error" title={t('project.synchronization_instance.error_message')}>
                {translateMessage(this.metrics.errorMessage)}
              </NAlert>
            )}
            
            {/* 进度条 */}
            <div class={styles['progress-section']}>
              <div class={styles['progress-header']}>
                <span class={styles['progress-label']}>
                  {t('project.synchronization_instance.execution_progress')}
                </span>
                <span class={styles['progress-percent']}>
                  {this.progressPercent}%
                </span>
              </div>
              <NProgress
                type="line"
                percentage={this.progressPercent}
                status={this.metrics.status === 'FAILED' ? 'error' : this.progressPercent === 100 ? 'success' : 'info'}
                height={24}
                border-radius={4}
                fill-border-radius={4}
                indicator-placement="inside"
                processing={this.metrics.status === 'RUNNING'}
              />
            </div>
            
            {/* 实时指标 */}
            <NGrid cols={2} x-gap={16} y-gap={16}>
              <NGridItem>
                <NCard title={t('project.synchronization_instance.read_metrics')} size="small">
                  <NSpace vertical>
                    <NStatistic label={t('project.synchronization_instance.amount_of_data_read')}>
                      {{
                        default: () => (
                          <span class={styles['metric-value']}>
                            {this.formatNumber(this.metrics.readRowCount)}
                          </span>
                        ),
                        suffix: () => <span class={styles['metric-unit']}>{t('project.synchronization_instance.line')}</span>
                      }}
                    </NStatistic>
                    <NStatistic label={t('project.synchronization_instance.read_rate')}>
                      {{
                        default: () => (
                          <span class={styles['metric-value']}>
                            {this.formatNumber(this.metrics.readRate)}
                          </span>
                        ),
                        suffix: () => <span class={styles['metric-unit']}>{t('project.synchronization_instance.line')}/s</span>
                      }}
                    </NStatistic>
                  </NSpace>
                </NCard>
              </NGridItem>
              
              <NGridItem>
                <NCard title={t('project.synchronization_instance.write_metrics')} size="small">
                  <NSpace vertical>
                    <NStatistic label={t('project.synchronization_instance.amount_of_data_written')}>
                      {{
                        default: () => (
                          <span class={styles['metric-value']}>
                            {this.formatNumber(this.metrics.writeRowCount)}
                          </span>
                        ),
                        suffix: () => <span class={styles['metric-unit']}>{t('project.synchronization_instance.line')}</span>
                      }}
                    </NStatistic>
                    <NStatistic label={t('project.synchronization_instance.write_rate')}>
                      {{
                        default: () => (
                          <span class={styles['metric-value']}>
                            {this.formatNumber(this.metrics.writeRate)}
                          </span>
                        ),
                        suffix: () => <span class={styles['metric-unit']}>{t('project.synchronization_instance.line')}/s</span>
                      }}
                    </NStatistic>
                  </NSpace>
                </NCard>
              </NGridItem>
              
              <NGridItem span={2}>
                <NCard size="small">
                  <NSpace justify="space-around">
                    <NStatistic label={t('project.synchronization_instance.run_time')}>
                      {{
                        default: () => (
                          <span class={styles['metric-value']}>
                            {this.formatDuration(this.metrics.duration)}
                          </span>
                        )
                      }}
                    </NStatistic>
                    <NStatistic label={t('project.synchronization_instance.state')}>
                      {{
                        default: () => (
                          <span class={styles['status-badge']} data-status={this.metrics.status.toLowerCase()}>
                            {t(`project.synchronization_instance.status_${this.metrics.status.toLowerCase()}`)}
                          </span>
                        )
                      }}
                    </NStatistic>
                  </NSpace>
                </NCard>
              </NGridItem>
            </NGrid>
            
            {/* 操作按钮 */}
            <NSpace justify="end">
              <NButton onClick={this.handleRefresh}>
                <span class="iconify" data-icon="material-symbols:refresh" style="margin-right: 4px;" />
                {t('project.synchronization_instance.refresh')}
              </NButton>
              <NButton type="primary" onClick={this.handleClose}>
                {t('project.synchronization_instance.confirm')}
              </NButton>
            </NSpace>
          </NSpace>
        </NSpin>
      </NModal>
    )
  }
})

export default TaskProgressMonitor

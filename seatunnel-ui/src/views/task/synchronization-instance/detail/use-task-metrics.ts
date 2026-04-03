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

import { reactive, ref, onMounted } from 'vue'
import type { EChartsOption, LineSeriesOption } from 'echarts'
import * as echarts from 'echarts'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { format, subDays, subHours, subMinutes } from 'date-fns'
import { 
  queryJobMetricsHistory,
  querySyncTaskInstanceDetail
} from '@/service/sync-task-instance'

type MetricField =
  | 'readRowCount'
  | 'writeRowCount'
  | 'readQps'
  | 'writeQps'
  | 'recordDelay'

type MetricRecord = {
  createTime: number
  readRowCount: number
  writeRowCount: number
  readQps: number
  writeQps: number
  recordDelay: number
}

export function useTaskMetrics() {
  const route = useRoute()
  const { t } = useI18n()
  
  const timeOptions = [
    {
      label: t('project.metrics.last_1_minute'),
      value: '1min',
      getTime: () => [subMinutes(new Date(), 1), new Date()]
    },
    {
      label: t('project.metrics.last_10_minutes'),
      value: '10min',
      getTime: () => [subMinutes(new Date(), 10), new Date()]
    },
    {
      label: t('project.metrics.last_1_hour'),
      value: '1hour',
      getTime: () => [subHours(new Date(), 1), new Date()]
    },
    {
      label: t('project.metrics.last_3_hours'),
      value: '3hours',
      getTime: () => [subHours(new Date(), 3), new Date()]
    },
    {
      label: t('project.metrics.last_1_day'),
      value: '1day',
      getTime: () => [subDays(new Date(), 1), new Date()]
    },
    {
      label: t('project.metrics.last_7_days'),
      value: '7days',
      getTime: () => [subDays(new Date(), 7), new Date()]
    },
    {
      label: t('project.metrics.custom_time'),
      value: 'custom'
    }
  ]

  const variables = reactive({
    readRowCountChartRef: ref(),
    writeRowCountChartRef: ref(),
    readQpsChartRef: ref(),
    writeQpsChartRef: ref(),
    delayChartRef: ref(),
    readRowCountChart: null as echarts.ECharts | null,
    writeRowCountChart: null as echarts.ECharts | null,
    readQpsChart: null as echarts.ECharts | null,
    writeQpsChart: null as echarts.ECharts | null,
    delayChart: null as echarts.ECharts | null,
    metricsData: [] as MetricRecord[],
    dateRange: null as [number, number] | null,
    selectedTimeOption: '1hour',
    showDatePicker: false,
    timeOptions
  })

  const formatTimeToString = (timestamp: number): string => {
    return format(timestamp, 'yyyy-MM-dd HH:mm:ss')
  }

  const toNumber = (value: unknown): number => {
    const result = Number(value)
    return Number.isFinite(result) ? result : 0
  }

  const normalizeMetricsData = (data: any[]): MetricRecord[] => {
    return (Array.isArray(data) ? data : [])
      .map((item) => {
        const time = new Date(item.createTime).getTime()
        return {
          createTime: Number.isFinite(time) ? time : Date.now(),
          readRowCount: toNumber(item.readRowCount),
          writeRowCount: toNumber(item.writeRowCount),
          readQps: toNumber(item.readQps),
          writeQps: toNumber(item.writeQps),
          recordDelay: toNumber(item.recordDelay)
        }
      })
      .sort((a, b) => a.createTime - b.createTime)
  }

  const getTimeRange = (data: MetricRecord[]): [number, number] => {
    if (variables.dateRange) {
      return variables.dateRange
    }

    if (data.length >= 2) {
      return [data[0].createTime, data[data.length - 1].createTime]
    }

    if (data.length === 1) {
      const single = data[0].createTime
      return [single - 30 * 60 * 1000, single + 30 * 60 * 1000]
    }

    const option = timeOptions.find((opt) => opt.value === variables.selectedTimeOption)
    if (option?.getTime) {
      const [start, end] = option.getTime()
      return [start.getTime(), end.getTime()]
    }

    const now = Date.now()
    return [now - 60 * 60 * 1000, now]
  }

  const buildSeriesData = (
    data: MetricRecord[],
    key: MetricField
  ): { points: Array<[number, number]>; hasRealData: boolean; isSinglePoint: boolean } => {
    if (data.length === 0) {
      return {
        points: [],
        hasRealData: false,
        isSinglePoint: false
      }
    }

    if (data.length === 1) {
      const [start, end] = getTimeRange(data)
      const value = data[0][key]
      const pointTime = data[0].createTime
      const left = Math.max(start, pointTime - Math.max((end - start) / 4, 1000))
      const right = Math.min(end, pointTime + Math.max((end - start) / 4, 1000))

      return {
        points: [
          [left, value],
          [pointTime, value],
          [right, value]
        ],
        hasRealData: true,
        isSinglePoint: true
      }
    }

    return {
      points: data.map((item) => [item.createTime, item[key]] as [number, number]),
      hasRealData: true,
      isSinglePoint: false
    }
  }

  const createYAxisRange = (values: number[]) => {
    if (!values.length) {
      return {
        min: 0,
        max: 1
      }
    }

    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)

    if (minValue === maxValue) {
      if (minValue === 0) {
        return {
          min: 0,
          max: 1
        }
      }

      const padding = Math.max(Math.abs(minValue) * 0.1, 1)
      return {
        min: Math.max(0, Math.floor(minValue - padding)),
        max: Math.ceil(maxValue + padding)
      }
    }

    const padding = Math.max((maxValue - minValue) * 0.1, 1)
    return {
      min: Math.max(0, Math.floor(minValue - padding)),
      max: Math.ceil(maxValue + padding)
    }
  }

  const getChartOption = (title: string, data: MetricRecord[], key: MetricField): EChartsOption => {
    const { points, hasRealData, isSinglePoint } = buildSeriesData(data, key)
    const values = points.map(([, value]) => value)
    const yAxisRange = createYAxisRange(values)
    const [startTime, endTime] = getTimeRange(data)

    return ({
    title: { 
      text: title,
      textStyle: {
        fontSize: 14,
        fontWeight: 'normal'
      },
      left: 'center'
    },
    tooltip: { 
      show: true,
      trigger: 'axis',
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: '#BFBFBF',
          type: 'dashed'
        }
      },
      position: 'top',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#E5E5E5',
      borderWidth: 1,
      padding: [8, 12],
      borderRadius: 4,
      textStyle: {
        color: '#595959',
        fontSize: 13
      },
      formatter: (params: any) => {
        const point = Array.isArray(params) ? params[0] : params
        if (!point) {
          return ''
        }

        let value = Array.isArray(point.value) ? point.value[1] : point.value
        if (key.includes('Qps')) {
          value = value.toFixed(2)
        } else if (value >= 10000) {
          value = (value / 10000).toFixed(1) + 'w'
        } else {
          value = Math.round(value)
        }
        
        try {
          const timeValue = Array.isArray(point.value) ? point.value[0] : point.axisValue
          const fullDateTime = formatTimeToString(Number(timeValue))
          
          return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif">
            <div style="color: #8c8c8c; font-size: 12px; margin-bottom: 4px">
              ${fullDateTime}
            </div>
            <div style="display: flex; align-items: center">
              <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: ${point.color}; margin-right: 8px"></span>
              <span style="font-weight: 500">${value}</span>
            </div>
            <div style="font-size: 12px; color: #8c8c8c; margin-top: 4px">
              ${title}
            </div>
          </div>`
        } catch (err) {
          console.error('Error formatting tooltip time:', err)
          return ''
        }
      }
    },
    grid: {
      top: '18%',
      left: '3%',
      right: '4%',
      bottom: '8%',
      containLabel: true
    },
    xAxis: {
      type: 'time',
      boundaryGap: false,
      min: startTime,
      max: endTime,
      axisLine: {
        lineStyle: {
          color: '#E5E5E5'
        }
      },
      axisLabel: {
        color: '#7F7F7F',
        hideOverlap: true,
        showMinLabel: true,
        showMaxLabel: false,
        margin: 12,
        formatter: (value: number) => {
          return format(value, 'HH:mm')
        }
      }
    },
    yAxis: { 
      type: 'value',
      min: yAxisRange.min,
      max: yAxisRange.max,
      minInterval: key.includes('Qps') ? 0.01 : 1,
      splitNumber: 4,
      splitLine: {
        lineStyle: {
          type: 'dashed',
          color: '#E5E5E5'
        }
      },
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        color: '#7F7F7F',
        formatter: (value: number) => {
          if (key.includes('Qps')) {
            if (Math.abs(value) >= 100) {
              return value.toFixed(0)
            }
            if (Math.abs(value) >= 10) {
              return value.toFixed(1)
            }
            return value.toFixed(2)
          }
          if (value >= 10000) {
            return (value / 10000).toFixed(1) + 'w'
          }
          return Number.isInteger(value) ? value.toString() : value.toFixed(1)
        }
      }
    },
    series: [{
      type: 'line',
      data: points,
      smooth: true,
      symbol: 'circle',
      symbolSize: isSinglePoint ? 8 : 6,
      showSymbol: true,
      triggerEvent: true,
      connectNulls: true,
      emphasis: {
        focus: 'series',
        itemStyle: {
          color: '#1890FF',
          borderWidth: 3,
          borderColor: '#1890FF',
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.2)'
        }
      },
      itemStyle: {
        color: '#1890FF',
        borderWidth: 1,
        borderColor: '#fff',
        opacity: hasRealData ? 0.9 : 0
      },
      lineStyle: {
        width: 2,
        opacity: hasRealData ? 1 : 0
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          {
            offset: 0,
            color: 'rgba(24,144,255,0.3)'
          },
          {
            offset: 1,
            color: 'rgba(24,144,255,0.1)'
          }
        ])
      },
      animationDuration: 400
    } as LineSeriesOption],
    graphic: !hasRealData
      ? [
          {
            type: 'text',
            left: 'center',
            top: 'middle',
            style: {
              text: t('project.metrics.no_data'),
              fill: '#8C8C8C',
              fontSize: 14,
              fontWeight: 400
            }
          }
        ]
      : undefined
  })
  }

  const initCharts = () => {
    try {
      if (variables.readRowCountChartRef) {
        variables.readRowCountChart?.dispose()
        variables.readRowCountChart = echarts.init(variables.readRowCountChartRef)
      }
      if (variables.writeRowCountChartRef) {
        variables.writeRowCountChart?.dispose()
        variables.writeRowCountChart = echarts.init(variables.writeRowCountChartRef)
      }
      if (variables.readQpsChartRef) {
        variables.readQpsChart?.dispose()
        variables.readQpsChart = echarts.init(variables.readQpsChartRef)
      }
      if (variables.writeQpsChartRef) {
        variables.writeQpsChart?.dispose()
        variables.writeQpsChart = echarts.init(variables.writeQpsChartRef)
      }
      if (variables.delayChartRef) {
        variables.delayChart?.dispose()
        variables.delayChart = echarts.init(variables.delayChartRef)
      }
    } catch (err) {
      console.error('Failed to initialize charts:', err)
    }
  }

  const getChartTitle = (key: string) => {
    return t(`project.task.metrics.${key}`)
  }

  const updateCharts = async () => {
    try {
      const params: any = {
        jobInstanceId: route.query.jobInstanceId as string
      }
      
      if (variables.dateRange) {
        params.startTime = format(variables.dateRange[0], 'yyyy-MM-dd HH:mm:ss')
        params.endTime = format(variables.dateRange[1], 'yyyy-MM-dd HH:mm:ss')
      }

      const res = await queryJobMetricsHistory(params)
      variables.metricsData = normalizeMetricsData(res)

      // If history is empty (common for short batch jobs or before persistence),
      // fallback to a single realtime point so the UI is not blank.
      if (!variables.metricsData || variables.metricsData.length === 0) {
        try {
          const detail = await querySyncTaskInstanceDetail({
            jobInstanceId: route.query.jobInstanceId as string
          })
          const realtime = Array.isArray(detail) ? detail : []
          const readRowCount = realtime.reduce((acc: number, it: any) => acc + Number(it.readRowCount || 0), 0)
          const writeRowCount = realtime.reduce((acc: number, it: any) => acc + Number(it.writeRowCount || 0), 0)
          const readQps = realtime.reduce((acc: number, it: any) => acc + Number(it.readQps || 0), 0)
          const writeQps = realtime.reduce((acc: number, it: any) => acc + Number(it.writeQps || 0), 0)
          const recordDelay = realtime.reduce((acc: number, it: any) => acc + Number(it.recordDelay || 0), 0)
          variables.metricsData = normalizeMetricsData([
            {
              createTime: new Date().toISOString(),
              readRowCount,
              writeRowCount,
              readQps,
              writeQps,
              recordDelay
            }
          ])
        } catch {
          // ignore fallback errors
        }
      }

      if (variables.readRowCountChart) {
        variables.readRowCountChart.setOption(
          getChartOption(getChartTitle('read_row_count'), variables.metricsData, 'readRowCount')
        )
      }
      if (variables.writeRowCountChart) {
        variables.writeRowCountChart.setOption(
          getChartOption(getChartTitle('write_row_count'), variables.metricsData, 'writeRowCount')
        )
      }
      if (variables.readQpsChart) {
        variables.readQpsChart.setOption(
          getChartOption(getChartTitle('read_qps'), variables.metricsData, 'readQps')
        )
      }
      if (variables.writeQpsChart) {
        variables.writeQpsChart.setOption(
          getChartOption(getChartTitle('write_qps'), variables.metricsData, 'writeQps')
        )
      }
      if (variables.delayChart) {
        variables.delayChart.setOption(
          getChartOption(getChartTitle('record_delay'), variables.metricsData, 'recordDelay')
        )
      }
    } catch (err) {
      console.error('Failed to fetch metrics data:', err)
    }
  }

  const handleTimeOptionChange = (value: string) => {
    variables.selectedTimeOption = value
    
    if (value === 'custom') {
      variables.showDatePicker = true
      return
    }
    
    variables.showDatePicker = false
    const option = timeOptions.find(opt => opt.value === value)
    if (option && option.getTime) {
      const [start, end] = option.getTime()
      variables.dateRange = [start.getTime(), end.getTime()]
      updateCharts()
    }
  }

  const handleDateRangeChange = (value: [number, number] | null) => {
    variables.dateRange = value
    variables.selectedTimeOption = 'custom'
    if (value) {
      updateCharts()
    }
  }

  onMounted(() => {
    handleTimeOptionChange('1hour')
  })

  return {
    variables,
    initCharts,
    updateCharts,
    handleDateRangeChange,
    handleTimeOptionChange
  }
} 

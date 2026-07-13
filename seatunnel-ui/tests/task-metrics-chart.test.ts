/*
 * @author: zhjj
 */

import {
  buildMetricSeriesData,
  formatMetricTooltip
} from '../src/views/task/synchronization-instance/detail/use-task-metrics'

describe('task metrics chart', () => {
  it('keeps only real metric timestamps as hoverable series points', () => {
    const data = [
      {
        createTime: new Date(2026, 6, 13, 10, 29, 15).getTime(),
        readRowCount: 25,
        writeRowCount: 20,
        readQps: 2,
        writeQps: 1,
        recordDelay: 0
      }
    ]

    expect(buildMetricSeriesData(data, 'writeRowCount')).toEqual([
      [data[0].createTime, 20]
    ])
  })

  it('shows the exact node time in the tooltip', () => {
    const timestamp = new Date(2026, 6, 13, 10, 29, 15).getTime()

    const tooltip = formatMetricTooltip(
      { value: [timestamp, 20], color: '#1890FF' },
      'writeRowCount',
      '写入数据量趋势'
    )

    expect(tooltip).toContain('2026-07-13 10:29:15')
    expect(tooltip).toContain('20')
    expect(tooltip).toContain('写入数据量趋势')
  })
})

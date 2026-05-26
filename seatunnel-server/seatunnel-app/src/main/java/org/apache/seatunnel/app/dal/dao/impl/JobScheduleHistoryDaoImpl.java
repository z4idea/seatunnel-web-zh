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

package org.apache.seatunnel.app.dal.dao.impl;

import org.apache.seatunnel.app.dal.dao.IJobInstanceDao;
import org.apache.seatunnel.app.dal.dao.IJobMetricsDao;
import org.apache.seatunnel.app.dal.dao.IJobScheduleHistoryDao;
import org.apache.seatunnel.app.dal.entity.JobInstance;
import org.apache.seatunnel.app.dal.entity.JobScheduleHistory;
import org.apache.seatunnel.app.dal.mapper.JobScheduleHistoryMapper;
import org.apache.seatunnel.app.domain.response.PageInfo;
import org.apache.seatunnel.app.domain.response.job.JobScheduleHistoryRes;

import org.springframework.stereotype.Repository;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import javax.annotation.Resource;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import static org.apache.seatunnel.app.utils.ServletUtils.getCurrentWorkspaceId;

@Repository
public class JobScheduleHistoryDaoImpl implements IJobScheduleHistoryDao {

    @Resource private JobScheduleHistoryMapper jobScheduleHistoryMapper;

    @Resource(name = "jobInstanceDaoImpl")
    private IJobInstanceDao jobInstanceDao;

    @Resource(name = "jobMetricsDaoImpl")
    private IJobMetricsDao jobMetricsDao;

    @Override
    public void insert(JobScheduleHistory history) {
        jobScheduleHistoryMapper.insert(history);
    }

    @Override
    public PageInfo<JobScheduleHistoryRes> getByJobDefineId(
            Long jobDefineId, Integer pageNo, Integer pageSize) {
        IPage<JobScheduleHistory> page =
                jobScheduleHistoryMapper.selectPage(
                        new Page<>(pageNo, pageSize),
                        Wrappers.<JobScheduleHistory>lambdaQuery()
                                .eq(JobScheduleHistory::getJobDefineId, jobDefineId)
                                .eq(JobScheduleHistory::getWorkspaceId, getCurrentWorkspaceId())
                                .orderByDesc(JobScheduleHistory::getTriggerTime));
        List<Long> jobInstanceIds =
                page.getRecords().stream()
                        .map(JobScheduleHistory::getJobInstanceId)
                        .filter(Objects::nonNull)
                        .distinct()
                        .collect(Collectors.toList());
        Map<Long, JobInstance> jobInstanceMap =
                jobInstanceDao.getAllJobInstance(jobInstanceIds).stream()
                        .collect(Collectors.toMap(JobInstance::getId, jobInstance -> jobInstance));
        Map<Long, Long> writeRowCountMap =
                jobInstanceIds.stream()
                        .collect(
                                Collectors.toMap(
                                        jobInstanceId -> jobInstanceId,
                                        jobInstanceId ->
                                                jobMetricsDao.getByInstanceId(jobInstanceId)
                                                        .stream()
                                                        .mapToLong(
                                                                metrics ->
                                                                        metrics.getWriteRowCount())
                                                        .sum()));
        PageInfo<JobScheduleHistoryRes> pageInfo = new PageInfo<>();
        pageInfo.setData(
                page.getRecords().stream()
                        .map(
                                history -> {
                                    JobInstance jobInstance =
                                            history.getJobInstanceId() == null
                                                    ? null
                                                    : jobInstanceMap.get(
                                                            history.getJobInstanceId());
                                    Long writeRowCount =
                                            history.getJobInstanceId() == null
                                                    ? null
                                                    : writeRowCountMap.get(
                                                            history.getJobInstanceId());
                                    return JobScheduleHistoryRes.builder()
                                            .id(history.getId())
                                            .scheduleConfigId(history.getScheduleConfigId())
                                            .jobDefineId(history.getJobDefineId())
                                            .triggerTime(history.getTriggerTime())
                                            .status(history.getStatus())
                                            .message(history.getMessage())
                                            .jobInstanceId(history.getJobInstanceId())
                                            .writeRowCount(writeRowCount)
                                            .errorMessage(
                                                    jobInstance == null
                                                            ? null
                                                            : jobInstance.getErrorMessage())
                                            .createTime(history.getCreateTime())
                                            .build();
                                })
                        .collect(Collectors.toList()));
        pageInfo.setPageNo(pageNo);
        pageInfo.setPageSize(pageSize);
        pageInfo.setTotalCount((int) page.getTotal());
        return pageInfo;
    }

    @Override
    public void deleteByJobDefineId(Long jobDefineId) {
        jobScheduleHistoryMapper.delete(
                Wrappers.<JobScheduleHistory>lambdaQuery()
                        .eq(JobScheduleHistory::getJobDefineId, jobDefineId)
                        .eq(JobScheduleHistory::getWorkspaceId, getCurrentWorkspaceId()));
    }
}

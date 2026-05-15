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

package org.apache.seatunnel.app.service.impl;

import org.apache.seatunnel.app.dal.dao.IJobDefinitionDao;
import org.apache.seatunnel.app.dal.dao.IJobScheduleConfigDao;
import org.apache.seatunnel.app.dal.dao.IJobScheduleHistoryDao;
import org.apache.seatunnel.app.dal.entity.JobDefinition;
import org.apache.seatunnel.app.dal.entity.JobScheduleConfig;
import org.apache.seatunnel.app.domain.request.job.JobScheduleConfigReq;
import org.apache.seatunnel.app.domain.request.job.JobScheduleEnableReq;
import org.apache.seatunnel.app.domain.response.PageInfo;
import org.apache.seatunnel.app.domain.response.job.JobScheduleConfigRes;
import org.apache.seatunnel.app.domain.response.job.JobScheduleHistoryRes;
import org.apache.seatunnel.app.scheduler.JobScheduleTimeCalculator;
import org.apache.seatunnel.app.scheduler.LocalJobScheduleRegistry;
import org.apache.seatunnel.app.security.UserContextHolder;
import org.apache.seatunnel.app.service.IJobScheduleService;
import org.apache.seatunnel.app.utils.ServletUtils;
import org.apache.seatunnel.common.access.AccessType;
import org.apache.seatunnel.common.access.ResourceType;
import org.apache.seatunnel.server.common.CodeGenerateUtils;
import org.apache.seatunnel.server.common.SeatunnelErrorEnum;
import org.apache.seatunnel.server.common.SeatunnelException;

import org.apache.commons.lang3.StringUtils;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import javax.annotation.Resource;

import java.util.Date;

@Service
public class JobScheduleServiceImpl extends SeatunnelBaseServiceImpl
        implements IJobScheduleService {

    @Resource(name = "jobDefinitionDaoImpl")
    private IJobDefinitionDao jobDefinitionDao;

    @Resource(name = "jobScheduleConfigDaoImpl")
    private IJobScheduleConfigDao jobScheduleConfigDao;

    @Resource(name = "jobScheduleHistoryDaoImpl")
    private IJobScheduleHistoryDao jobScheduleHistoryDao;

    @Resource private JobScheduleTimeCalculator jobScheduleTimeCalculator;

    @Resource private LocalJobScheduleRegistry localJobScheduleRegistry;

    @Override
    public JobScheduleConfigRes getJobSchedule(Long jobDefineId) {
        JobDefinition jobDefinition = getJobDefinitionWithPermission(jobDefineId, AccessType.READ);
        JobScheduleConfig config = jobScheduleConfigDao.getByJobDefineId(jobDefineId);
        if (config == null) {
            return JobScheduleConfigRes.builder()
                    .jobDefineId(jobDefinition.getId())
                    .enabled(false)
                    .build();
        }
        return toResponse(config, true);
    }

    @Override
    @Transactional
    public JobScheduleConfigRes saveJobSchedule(JobScheduleConfigReq req) {
        validateConfigReq(req);
        getJobDefinitionWithPermission(req.getJobDefineId(), AccessType.EXECUTE);
        Integer currentUserId = ServletUtils.getCurrentUserId();
        Long workspaceId = ServletUtils.getCurrentWorkspaceId();
        JobScheduleConfig config = jobScheduleConfigDao.getByJobDefineId(req.getJobDefineId());
        Date nextTriggerTime = null;
        if (Boolean.TRUE.equals(req.getEnabled())) {
            nextTriggerTime =
                    jobScheduleTimeCalculator.calculateNextTriggerTime(
                            req.getCronExpression(),
                            req.getActiveStartTime(),
                            req.getActiveEndTime(),
                            new Date());
        }
        if (config == null) {
            config =
                    JobScheduleConfig.builder()
                            .id(CodeGenerateUtils.getInstance().genCode())
                            .jobDefineId(req.getJobDefineId())
                            .cronExpression(req.getCronExpression())
                            .enabled(Boolean.TRUE.equals(req.getEnabled()))
                            .activeStartTime(req.getActiveStartTime())
                            .activeEndTime(req.getActiveEndTime())
                            .nextTriggerTime(nextTriggerTime)
                            .createUserId(currentUserId)
                            .updateUserId(currentUserId)
                            .workspaceId(workspaceId)
                            .build();
            jobScheduleConfigDao.insert(config);
        } else {
            config.setCronExpression(req.getCronExpression());
            config.setEnabled(Boolean.TRUE.equals(req.getEnabled()));
            config.setActiveStartTime(req.getActiveStartTime());
            config.setActiveEndTime(req.getActiveEndTime());
            config.setNextTriggerTime(nextTriggerTime);
            config.setUpdateUserId(currentUserId);
            jobScheduleConfigDao.update(config);
        }
        JobScheduleConfig savedConfig = config;
        scheduleAfterCommit(() -> localJobScheduleRegistry.registerOrRefresh(savedConfig));
        return toResponse(savedConfig, false);
    }

    @Override
    @Transactional
    public JobScheduleConfigRes updateJobScheduleEnabled(JobScheduleEnableReq req) {
        if (req.getJobDefineId() == null || req.getEnabled() == null) {
            throw new SeatunnelException(
                    SeatunnelErrorEnum.PARAM_CAN_NOT_BE_NULL, "jobDefineId and enabled");
        }
        getJobDefinitionWithPermission(req.getJobDefineId(), AccessType.EXECUTE);
        JobScheduleConfig config = jobScheduleConfigDao.getByJobDefineId(req.getJobDefineId());
        if (config == null) {
            throw new SeatunnelException(
                    SeatunnelErrorEnum.RESOURCE_NOT_FOUND,
                    "Schedule config for jobDefineId " + req.getJobDefineId() + " not found.");
        }
        config.setEnabled(req.getEnabled());
        config.setUpdateUserId(ServletUtils.getCurrentUserId());
        if (Boolean.TRUE.equals(req.getEnabled())) {
            config.setNextTriggerTime(
                    jobScheduleTimeCalculator.calculateNextTriggerTime(
                            config.getCronExpression(),
                            config.getActiveStartTime(),
                            config.getActiveEndTime(),
                            new Date()));
        } else {
            config.setNextTriggerTime(null);
        }
        jobScheduleConfigDao.update(config);
        scheduleAfterCommit(() -> localJobScheduleRegistry.registerOrRefresh(config));
        return toResponse(config, false);
    }

    @Override
    public PageInfo<JobScheduleHistoryRes> getJobScheduleHistory(
            Long jobDefineId, Integer pageNo, Integer pageSize) {
        getJobDefinitionWithPermission(jobDefineId, AccessType.READ);
        return jobScheduleHistoryDao.getByJobDefineId(jobDefineId, pageNo, pageSize);
    }

    @Override
    @Transactional
    public void deleteByJobDefineId(Long jobDefineId) {
        JobScheduleConfig config = jobScheduleConfigDao.getByJobDefineId(jobDefineId);
        jobScheduleHistoryDao.deleteByJobDefineId(jobDefineId);
        if (config == null) {
            return;
        }
        jobScheduleConfigDao.deleteByJobDefineId(jobDefineId);
        scheduleAfterCommit(() -> localJobScheduleRegistry.unregister(config.getId()));
    }

    private void validateConfigReq(JobScheduleConfigReq req) {
        if (req.getJobDefineId() == null) {
            throw new SeatunnelException(SeatunnelErrorEnum.PARAM_CAN_NOT_BE_NULL, "jobDefineId");
        }
        if (StringUtils.isBlank(req.getCronExpression())) {
            throw new SeatunnelException(
                    SeatunnelErrorEnum.PARAM_CAN_NOT_BE_NULL, "cronExpression");
        }
        try {
            jobScheduleTimeCalculator.validate(req.getCronExpression());
        } catch (IllegalArgumentException e) {
            throw new SeatunnelException(
                    SeatunnelErrorEnum.ILLEGAL_STATE,
                    "Invalid cron expression: " + req.getCronExpression());
        }
        if (req.getActiveStartTime() != null
                && req.getActiveEndTime() != null
                && req.getActiveStartTime().after(req.getActiveEndTime())) {
            throw new SeatunnelException(
                    SeatunnelErrorEnum.ILLEGAL_STATE,
                    "activeStartTime can not be later than activeEndTime.");
        }
        if (req.getEnabled() == null) {
            throw new SeatunnelException(SeatunnelErrorEnum.PARAM_CAN_NOT_BE_NULL, "enabled");
        }
    }

    private JobDefinition getJobDefinitionWithPermission(Long jobDefineId, AccessType accessType) {
        JobDefinition jobDefinition = jobDefinitionDao.getJob(jobDefineId);
        if (jobDefinition == null) {
            throw new SeatunnelException(
                    SeatunnelErrorEnum.RESOURCE_NOT_FOUND,
                    "Job definition " + jobDefineId + " not found.");
        }
        permissionCheck(
                jobDefinition.getName(),
                ResourceType.JOB,
                accessType,
                UserContextHolder.getAccessInfo());
        return jobDefinition;
    }

    private JobScheduleConfigRes toResponse(
            JobScheduleConfig config, boolean refreshNextTriggerTime) {
        Date nextTriggerTime = config.getNextTriggerTime();
        if (refreshNextTriggerTime
                && Boolean.TRUE.equals(config.getEnabled())
                && (nextTriggerTime == null || nextTriggerTime.before(new Date()))) {
            nextTriggerTime =
                    jobScheduleTimeCalculator.calculateNextTriggerTime(
                            config.getCronExpression(),
                            config.getActiveStartTime(),
                            config.getActiveEndTime(),
                            new Date());
        }
        return JobScheduleConfigRes.builder()
                .id(config.getId())
                .jobDefineId(config.getJobDefineId())
                .cronExpression(config.getCronExpression())
                .enabled(Boolean.TRUE.equals(config.getEnabled()))
                .activeStartTime(config.getActiveStartTime())
                .activeEndTime(config.getActiveEndTime())
                .nextTriggerTime(nextTriggerTime)
                .lastTriggerTime(config.getLastTriggerTime())
                .lastScheduleStatus(config.getLastScheduleStatus())
                .lastScheduleMessage(config.getLastScheduleMessage())
                .build();
    }

    private void scheduleAfterCommit(Runnable runnable) {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            runnable.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        runnable.run();
                    }
                });
    }
}

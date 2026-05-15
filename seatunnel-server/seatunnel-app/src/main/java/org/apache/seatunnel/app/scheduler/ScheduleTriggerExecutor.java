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

package org.apache.seatunnel.app.scheduler;

import org.apache.seatunnel.app.common.JobScheduleStatus;
import org.apache.seatunnel.app.common.Result;
import org.apache.seatunnel.app.dal.dao.IJobDefinitionDao;
import org.apache.seatunnel.app.dal.dao.IJobScheduleConfigDao;
import org.apache.seatunnel.app.dal.dao.IJobScheduleHistoryDao;
import org.apache.seatunnel.app.dal.entity.JobDefinition;
import org.apache.seatunnel.app.dal.entity.JobScheduleConfig;
import org.apache.seatunnel.app.dal.entity.JobScheduleHistory;
import org.apache.seatunnel.app.security.UserContext;
import org.apache.seatunnel.app.security.UserContextHolder;
import org.apache.seatunnel.app.service.IJobExecutorService;
import org.apache.seatunnel.server.common.CodeGenerateUtils;

import org.apache.commons.lang3.StringUtils;

import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

import javax.annotation.Resource;

import java.util.Date;

@Slf4j
@Component
public class ScheduleTriggerExecutor {

    private static final int MAX_MESSAGE_LENGTH = 1024;

    @Resource private IJobScheduleConfigDao jobScheduleConfigDao;

    @Resource private IJobScheduleHistoryDao jobScheduleHistoryDao;

    @Resource private IJobDefinitionDao jobDefinitionDao;

    @Resource private IJobExecutorService jobExecutorService;

    @Resource private JobScheduleTimeCalculator jobScheduleTimeCalculator;

    @Resource private JobScheduleUserContextFactory jobScheduleUserContextFactory;

    public void fire(Long scheduleConfigId) {
        JobScheduleConfig config = jobScheduleConfigDao.getById(scheduleConfigId);
        if (config == null) {
            return;
        }
        Date triggerTime = new Date();
        if (!Boolean.TRUE.equals(config.getEnabled())) {
            updateScheduleResult(
                    config, triggerTime, JobScheduleStatus.SKIPPED, "Schedule disabled.", null);
            return;
        }
        if (outOfActiveWindow(config, triggerTime)) {
            updateScheduleResult(
                    config,
                    triggerTime,
                    JobScheduleStatus.SKIPPED,
                    "Current trigger time is outside the active window.",
                    null);
            return;
        }

        UserContext userContext = null;
        try {
            userContext = jobScheduleUserContextFactory.create(config);
            UserContextHolder.setUserContext(userContext);

            JobDefinition jobDefinition = jobDefinitionDao.getJob(config.getJobDefineId());
            if (jobDefinition == null) {
                updateScheduleResult(
                        config,
                        triggerTime,
                        JobScheduleStatus.FAILED,
                        "Job definition not found.",
                        null);
                return;
            }

            Result<Long> executeResult =
                    jobExecutorService.jobExecute(config.getJobDefineId(), null);
            if (executeResult.isSuccess()) {
                updateScheduleResult(
                        config,
                        triggerTime,
                        JobScheduleStatus.SUCCESS,
                        buildSuccessMessage(executeResult.getData()),
                        executeResult.getData());
            } else {
                updateScheduleResult(
                        config,
                        triggerTime,
                        JobScheduleStatus.FAILED,
                        defaultMessage(
                                executeResult.getMsg(), "Schedule execution submission failed."),
                        null);
            }
        } catch (Exception e) {
            log.error(
                    "Schedule trigger execution failed, scheduleConfigId={}", scheduleConfigId, e);
            updateScheduleResult(
                    config,
                    triggerTime,
                    JobScheduleStatus.FAILED,
                    defaultMessage(e.getMessage(), "Schedule execution failed."),
                    null);
        } finally {
            if (userContext != null) {
                UserContextHolder.clear();
            }
        }
    }

    private void updateScheduleResult(
            JobScheduleConfig config,
            Date triggerTime,
            JobScheduleStatus status,
            String message,
            Long jobInstanceId) {
        config.setLastTriggerTime(triggerTime);
        config.setLastScheduleStatus(status.name());
        config.setLastScheduleMessage(truncate(message));
        if (Boolean.TRUE.equals(config.getEnabled())) {
            config.setNextTriggerTime(
                    jobScheduleTimeCalculator.calculateNextTriggerTime(
                            config.getCronExpression(),
                            config.getActiveStartTime(),
                            config.getActiveEndTime(),
                            triggerTime));
        } else {
            config.setNextTriggerTime(null);
        }
        jobScheduleConfigDao.update(config);
        jobScheduleHistoryDao.insert(
                JobScheduleHistory.builder()
                        .id(CodeGenerateUtils.getInstance().genCode())
                        .scheduleConfigId(config.getId())
                        .jobDefineId(config.getJobDefineId())
                        .triggerTime(triggerTime)
                        .status(status.name())
                        .message(truncate(message))
                        .jobInstanceId(jobInstanceId)
                        .workspaceId(config.getWorkspaceId())
                        .build());
    }

    private boolean outOfActiveWindow(JobScheduleConfig config, Date triggerTime) {
        return config.getActiveStartTime() != null
                        && triggerTime.before(config.getActiveStartTime())
                || config.getActiveEndTime() != null
                        && triggerTime.after(config.getActiveEndTime());
    }

    private String buildSuccessMessage(Long jobInstanceId) {
        if (jobInstanceId == null) {
            return "Schedule submitted successfully.";
        }
        return "Created job instance #" + jobInstanceId;
    }

    private String defaultMessage(String message, String defaultMessage) {
        return StringUtils.isBlank(message) ? defaultMessage : message;
    }

    private String truncate(String message) {
        if (message == null || message.length() <= MAX_MESSAGE_LENGTH) {
            return message;
        }
        return message.substring(0, MAX_MESSAGE_LENGTH);
    }
}

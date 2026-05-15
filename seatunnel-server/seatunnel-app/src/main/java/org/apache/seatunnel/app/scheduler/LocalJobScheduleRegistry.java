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

import org.apache.seatunnel.app.dal.dao.IJobScheduleConfigDao;
import org.apache.seatunnel.app.dal.entity.JobScheduleConfig;

import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.stereotype.Component;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.Resource;

import java.util.Date;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

@Slf4j
@Component
public class LocalJobScheduleRegistry {

    private final Map<Long, RegisteredScheduleTask> registeredTasks = new ConcurrentHashMap<>();

    @Resource private ThreadPoolTaskScheduler jobScheduleTaskScheduler;

    @Resource private ScheduleTriggerExecutor scheduleTriggerExecutor;

    @Resource private JobScheduleTimeCalculator jobScheduleTimeCalculator;

    @Resource private IJobScheduleConfigDao jobScheduleConfigDao;

    public void loadAndRegisterAllEnabled() {
        jobScheduleConfigDao.listEnabledSchedules().forEach(this::registerOrRefreshSafely);
    }

    public synchronized void registerOrRefresh(JobScheduleConfig config) {
        unregister(config.getId());
        if (!Boolean.TRUE.equals(config.getEnabled())) {
            return;
        }
        Date nextTriggerTime =
                jobScheduleTimeCalculator.calculateNextTriggerTime(
                        config.getCronExpression(),
                        config.getActiveStartTime(),
                        config.getActiveEndTime(),
                        new Date());
        config.setNextTriggerTime(nextTriggerTime);
        jobScheduleConfigDao.update(config);
        if (nextTriggerTime == null) {
            return;
        }
        ScheduledFuture<?> scheduledFuture =
                jobScheduleTaskScheduler.schedule(
                        () -> scheduleTriggerExecutor.fire(config.getId()),
                        new WindowedCronTrigger(
                                config.getCronExpression(),
                                config.getActiveStartTime(),
                                config.getActiveEndTime(),
                                jobScheduleTimeCalculator));
        if (scheduledFuture != null) {
            registeredTasks.put(
                    config.getId(),
                    new RegisteredScheduleTask(
                            config.getId(),
                            config.getJobDefineId(),
                            config.getCronExpression(),
                            scheduledFuture,
                            new Date()));
        }
    }

    public synchronized void unregister(Long scheduleConfigId) {
        RegisteredScheduleTask registeredScheduleTask = registeredTasks.remove(scheduleConfigId);
        if (registeredScheduleTask != null) {
            registeredScheduleTask.getFuture().cancel(false);
        }
    }

    public boolean isRegistered(Long scheduleConfigId) {
        return registeredTasks.containsKey(scheduleConfigId);
    }

    private void registerOrRefreshSafely(JobScheduleConfig config) {
        try {
            registerOrRefresh(config);
        } catch (Exception e) {
            log.error("Failed to register schedule config {}", config.getId(), e);
        }
    }

    @Getter
    @AllArgsConstructor
    private static class RegisteredScheduleTask {
        private final Long scheduleConfigId;
        private final Long jobDefineId;
        private final String cronExpression;
        private final ScheduledFuture<?> future;
        private final Date registeredAt;
    }
}

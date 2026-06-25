/*
 * @author: zhjj
 *
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

import org.apache.seatunnel.app.config.ScheduleProperties;

import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Component;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Date;

@Component
public class JobScheduleTimeCalculator {

    private static final long PREVIOUS_SECOND_MILLIS = 1000L;

    private final ScheduleProperties scheduleProperties;

    public JobScheduleTimeCalculator(ScheduleProperties scheduleProperties) {
        this.scheduleProperties = scheduleProperties;
    }

    public void validate(String cronExpression) {
        CronExpression.parse(cronExpression);
    }

    public Date calculateNextTriggerTime(
            String cronExpression, Date activeStartTime, Date activeEndTime, Date referenceTime) {
        CronExpression cron = CronExpression.parse(cronExpression);
        Date baseTime = referenceTime == null ? new Date() : referenceTime;
        if (activeEndTime != null && baseTime.after(activeEndTime)) {
            return null;
        }
        if (activeStartTime != null && baseTime.before(activeStartTime)) {
            baseTime = new Date(activeStartTime.getTime() - PREVIOUS_SECOND_MILLIS);
        }
        ZonedDateTime nextTriggerTime = cron.next(toScheduleTime(baseTime));
        if (nextTriggerTime == null) {
            return null;
        }
        Date nextTriggerDate = Date.from(nextTriggerTime.toInstant());
        if (activeEndTime != null && nextTriggerDate.after(activeEndTime)) {
            return null;
        }
        return nextTriggerDate;
    }

    private ZonedDateTime toScheduleTime(Date value) {
        return ZonedDateTime.ofInstant(value.toInstant(), getScheduleZoneId());
    }

    private ZoneId getScheduleZoneId() {
        return ZoneId.of(scheduleProperties.getTimeZone());
    }
}

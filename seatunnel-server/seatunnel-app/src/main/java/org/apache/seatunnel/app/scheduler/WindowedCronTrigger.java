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

import org.springframework.scheduling.Trigger;
import org.springframework.scheduling.TriggerContext;

import java.util.Date;

public class WindowedCronTrigger implements Trigger {

    private final String cronExpression;
    private final Date activeStartTime;
    private final Date activeEndTime;
    private final JobScheduleTimeCalculator timeCalculator;

    public WindowedCronTrigger(
            String cronExpression,
            Date activeStartTime,
            Date activeEndTime,
            JobScheduleTimeCalculator timeCalculator) {
        this.cronExpression = cronExpression;
        this.activeStartTime = activeStartTime;
        this.activeEndTime = activeEndTime;
        this.timeCalculator = timeCalculator;
    }

    @Override
    public Date nextExecutionTime(TriggerContext triggerContext) {
        Date referenceTime = triggerContext.lastCompletionTime();
        if (referenceTime == null) {
            referenceTime = triggerContext.lastScheduledExecutionTime();
        }
        if (referenceTime == null) {
            referenceTime = new Date();
        }
        return timeCalculator.calculateNextTriggerTime(
                cronExpression, activeStartTime, activeEndTime, referenceTime);
    }
}

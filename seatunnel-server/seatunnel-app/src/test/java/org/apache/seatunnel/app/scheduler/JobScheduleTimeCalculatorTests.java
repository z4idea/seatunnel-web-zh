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

import org.junit.jupiter.api.Test;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.TimeZone;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class JobScheduleTimeCalculatorTests {

    private final JobScheduleTimeCalculator calculator =
            new JobScheduleTimeCalculator(new ScheduleProperties());

    @Test
    public void testValidate_AcceptsLastDayCronExpressions() {
        assertDoesNotThrow(() -> calculator.validate("21 21 21 L * ?"));
        assertDoesNotThrow(() -> calculator.validate("21 21 21 L 12 ?"));
        assertDoesNotThrow(() -> calculator.validate("21 21 21 L 3,6,9,12 ?"));
    }

    @Test
    public void testCalculateNextTriggerTime_QuarterLastDayTemplateUsesQuarterEndDate()
            throws ParseException {
        Date nextTriggerTime =
                calculator.calculateNextTriggerTime(
                        "21 21 21 L 3,6,9,12 ?",
                        null,
                        null,
                        parseShanghaiTime("2026-06-25 00:00:00"));

        assertEquals(parseShanghaiTime("2026-06-30 21:21:21"), nextTriggerTime);
    }

    private Date parseShanghaiTime(String value) throws ParseException {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        format.setTimeZone(TimeZone.getTimeZone("Asia/Shanghai"));
        return format.parse(value);
    }
}

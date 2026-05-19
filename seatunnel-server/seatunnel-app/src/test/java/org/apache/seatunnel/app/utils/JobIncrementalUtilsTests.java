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

package org.apache.seatunnel.app.utils;

import org.apache.seatunnel.app.common.JdbcIncrementalColumnType;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

public class JobIncrementalUtilsTests {

    @Test
    void shouldBuildNumericRangeWithoutStaticFilter() {
        String whereCondition =
                JobIncrementalUtils.buildWhereCondition(
                        null, "`id`", "100", "180", JdbcIncrementalColumnType.NUMBER);

        Assertions.assertEquals("WHERE `id` > 100 AND `id` <= 180", whereCondition);
    }

    @Test
    void shouldMergeStaticFilterAndNoDataGuard() {
        String whereCondition =
                JobIncrementalUtils.buildWhereCondition(
                        "status = 1", "`id`", "100", null, JdbcIncrementalColumnType.NUMBER);

        Assertions.assertEquals("WHERE (status = 1) AND (1 = 0)", whereCondition);
    }

    @Test
    void shouldAdvanceTimestampOnlyForward() {
        Assertions.assertTrue(
                JobIncrementalUtils.shouldAdvance(
                        "2024-01-01 08:00:00",
                        "2024-01-01 09:00:00",
                        JdbcIncrementalColumnType.TIMESTAMP));
        Assertions.assertFalse(
                JobIncrementalUtils.shouldAdvance(
                        "2024-01-01 09:00:00",
                        "2024-01-01 08:00:00",
                        JdbcIncrementalColumnType.TIMESTAMP));
    }
}

/*
 * @author: zhjj
 */
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

import org.apache.seatunnel.app.dal.entity.JobTask;
import org.apache.seatunnel.app.domain.request.job.DataSourceOption;
import org.apache.seatunnel.app.domain.request.job.DatabaseTableSchemaReq;
import org.apache.seatunnel.common.utils.JsonUtils;

import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;

class JobDefinitionSourceDatabaseTableFormatterTest {

    @Test
    void shouldFormatSourceTablesFromOutputSchema() {
        JobTask sourceTask =
                JobTask.builder()
                        .type("SOURCE")
                        .outputSchema(
                                JsonUtils.toJsonString(
                                        Arrays.asList(
                                                new DatabaseTableSchemaReq("ods", "orders", null),
                                                new DatabaseTableSchemaReq(
                                                        "dim", "customers", null))))
                        .build();
        JobTask sinkTask = JobTask.builder().type("SINK").build();

        String formatted =
                JobDefinitionSourceDatabaseTableFormatter.format(
                        Arrays.asList(sourceTask, sinkTask));

        assertEquals("ods-orders, dim-customers", formatted);
    }

    @Test
    void shouldFallbackToDatasourceOptionWhenOutputSchemaMissing() {
        JobTask sourceTask =
                JobTask.builder()
                        .type("SOURCE")
                        .dataSourceOption(
                                JsonUtils.toJsonString(
                                        new DataSourceOption(
                                                Collections.singletonList("ods"),
                                                Arrays.asList("orders", "payments"))))
                        .build();

        String formatted =
                JobDefinitionSourceDatabaseTableFormatter.format(
                        Collections.singletonList(sourceTask));

        assertEquals("ods-orders, ods-payments", formatted);
    }

    @Test
    void shouldDeduplicateAndHideDefaultDatabasePrefix() {
        JobTask sourceTask =
                JobTask.builder()
                        .type("SOURCE")
                        .outputSchema(
                                JsonUtils.toJsonString(
                                        Arrays.asList(
                                                new DatabaseTableSchemaReq(
                                                        "default", "http_source", null),
                                                new DatabaseTableSchemaReq(
                                                        "default", "http_source", null))))
                        .build();

        String formatted =
                JobDefinitionSourceDatabaseTableFormatter.format(
                        Collections.singletonList(sourceTask));

        assertEquals("http_source", formatted);
    }
}

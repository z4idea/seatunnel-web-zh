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

package org.apache.seatunnel.app.service.impl;

import org.apache.seatunnel.app.dal.entity.JobInstance;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class SlinkMetadataSyncServiceTests {

    @Test
    @SuppressWarnings("unchecked")
    public void testSyncFinishedJobMetadata_PostsSlinkSinkMetadata() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SlinkMetadataSyncService service = new SlinkMetadataSyncService();
        ReflectionTestUtils.setField(service, "restTemplate", restTemplate);
        ReflectionTestUtils.setField(service, "baseUrl", "http://192.168.76.134:17081");
        ReflectionTestUtils.setField(service, "syncPath", "/admin-api/data/metadata/sync");

        when(restTemplate.postForEntity(
                        eq("http://192.168.76.134:17081/admin-api/data/metadata/sync"),
                        any(HttpEntity.class),
                        eq(String.class)))
                .thenReturn(new ResponseEntity<>("{}", HttpStatus.OK));

        JobInstance jobInstance = new JobInstance();
        jobInstance.setId(1001L);
        jobInstance.setJobConfig(
                "env {\n"
                        + "\"job.mode\"=BATCH\n"
                        + "}\n"
                        + "source {\n"
                        + "}\n"
                        + "transform {\n"
                        + "}\n"
                        + "sink {\n"
                        + "Jdbc {\n"
                        + "    datasourceOrigin=SLINK\n"
                        + "    table=\"COLLECT.USER\"\n"
                        + "    user=\"audit_user\"\n"
                        + "    password=\"secret\"\n"
                        + "    driver=\"dm.jdbc.driver.DmDriver\"\n"
                        + "    url=\"jdbc:dm://192.168.76.134:25236\"\n"
                        + "}\n"
                        + "}\n");

        service.syncFinishedJobMetadata(jobInstance);

        ArgumentCaptor<HttpEntity> entityCaptor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate)
                .postForEntity(
                        eq("http://192.168.76.134:17081/admin-api/data/metadata/sync"),
                        entityCaptor.capture(),
                        eq(String.class));

        HttpEntity<Map<String, Object>> requestEntity = entityCaptor.getValue();
        Map<String, Object> body = requestEntity.getBody();
        assertNotNull(body);
        assertEquals("COLLECT.USER", body.get("tableName"));
        Map<String, Object> datasourceLink = (Map<String, Object>) body.get("datasourceLinkDTO");
        assertNotNull(datasourceLink);
        assertEquals("jdbc:dm://192.168.76.134:25236", datasourceLink.get("jdbcUrl"));
        assertEquals("dm.jdbc.driver.DmDriver", datasourceLink.get("driver"));
        assertEquals("audit_user", datasourceLink.get("username"));
        assertEquals("secret", datasourceLink.get("password"));
    }

    @Test
    public void testSyncFinishedJobMetadata_IgnoresNonSlinkSink() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SlinkMetadataSyncService service = new SlinkMetadataSyncService();
        ReflectionTestUtils.setField(service, "restTemplate", restTemplate);
        ReflectionTestUtils.setField(service, "baseUrl", "http://192.168.76.134:17081");
        ReflectionTestUtils.setField(service, "syncPath", "/admin-api/data/metadata/sync");

        JobInstance jobInstance = new JobInstance();
        jobInstance.setId(1002L);
        jobInstance.setJobConfig(
                "env {\n"
                        + "}\n"
                        + "source {\n"
                        + "}\n"
                        + "transform {\n"
                        + "}\n"
                        + "sink {\n"
                        + "Jdbc {\n"
                        + "    datasourceOrigin=USER\n"
                        + "    table=\"test.user\"\n"
                        + "    user=\"root\"\n"
                        + "    password=\"123456\"\n"
                        + "    driver=\"com.mysql.cj.jdbc.Driver\"\n"
                        + "    url=\"jdbc:mysql://localhost:3306/test\"\n"
                        + "}\n"
                        + "}\n");

        service.syncFinishedJobMetadata(jobInstance);

        verify(restTemplate, never())
                .postForEntity(any(String.class), any(HttpEntity.class), eq(String.class));
    }
}

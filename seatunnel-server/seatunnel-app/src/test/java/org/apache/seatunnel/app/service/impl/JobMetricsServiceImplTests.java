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

import org.apache.seatunnel.app.dal.dao.IJobInstanceDao;
import org.apache.seatunnel.app.dal.dao.IJobInstanceHistoryDao;
import org.apache.seatunnel.app.dal.dao.IJobMetricsDao;
import org.apache.seatunnel.app.dal.entity.JobInstance;
import org.apache.seatunnel.app.dal.entity.JobInstanceHistory;
import org.apache.seatunnel.app.dal.entity.JobMetrics;
import org.apache.seatunnel.app.dal.entity.User;
import org.apache.seatunnel.app.domain.response.metrics.Edge;
import org.apache.seatunnel.app.domain.response.metrics.JobDAG;
import org.apache.seatunnel.app.domain.response.metrics.JobPipelineDetailMetricsRes;
import org.apache.seatunnel.app.domain.response.metrics.JobSummaryMetricsRes;
import org.apache.seatunnel.app.domain.response.metrics.VertexInfo;
import org.apache.seatunnel.app.security.UserContext;
import org.apache.seatunnel.app.security.UserContextHolder;
import org.apache.seatunnel.common.constants.JobMode;
import org.apache.seatunnel.common.constants.PluginType;
import org.apache.seatunnel.common.utils.JsonUtils;
import org.apache.seatunnel.engine.core.job.JobStatus;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class JobMetricsServiceImplTests {

    @AfterEach
    public void clearUserContext() {
        UserContextHolder.clear();
    }

    @Test
    public void testGetAllJobSummaryMetrics_EndStateJobsUseBatchDbMetricsWithoutEngineLookup() {
        JobMetricsServiceImpl service = new JobMetricsServiceImpl();
        IJobInstanceDao jobInstanceDao = mock(IJobInstanceDao.class);
        IJobMetricsDao jobMetricsDao = mock(IJobMetricsDao.class);

        ReflectionTestUtils.setField(service, "jobInstanceDao", jobInstanceDao);
        ReflectionTestUtils.setField(service, "jobMetricsDao", jobMetricsDao);

        User user = new User();
        user.setId(9);
        UserContextHolder.setUserContext(new UserContext(user, 1L, null));

        List<Long> instanceIds = Arrays.asList(101L, 102L);
        Map<Long, Long> instanceAndEngineIds = new HashMap<>();
        instanceAndEngineIds.put(101L, 9001L);
        instanceAndEngineIds.put(102L, 9002L);

        when(jobInstanceDao.getAllJobInstance(eq(instanceIds)))
                .thenReturn(
                        Arrays.asList(
                                buildEndedJobInstance(101L, "9001", JobStatus.FINISHED),
                                buildEndedJobInstance(102L, "9002", JobStatus.FAILED)));
        when(jobMetricsDao.getByInstanceIds(eq(instanceIds)))
                .thenReturn(
                        Arrays.asList(
                                buildMetric(101L, 10L, 20L),
                                buildMetric(101L, 2L, 3L),
                                buildMetric(102L, 30L, 40L)));

        Map<Long, JobSummaryMetricsRes> result =
                service.getALLJobSummaryMetrics(instanceAndEngineIds, instanceIds, JobMode.BATCH);

        assertNotNull(result);
        assertEquals(2, result.size());
        assertEquals(12L, result.get(101L).getReadRowCount());
        assertEquals(23L, result.get(101L).getWriteRowCount());
        assertEquals(30L, result.get(102L).getReadRowCount());
        assertEquals(40L, result.get(102L).getWriteRowCount());
        verify(jobMetricsDao).getByInstanceIds(eq(instanceIds));
        verify(jobMetricsDao, never()).getByInstanceId(anyLong());
    }

    @Test
    public void testGetJobPipelineDetailMetrics_FillsBlankSourceAndSinkNamesFromDagForEndedJob() {
        JobMetricsServiceImpl service = new JobMetricsServiceImpl();
        IJobMetricsDao jobMetricsDao = mock(IJobMetricsDao.class);
        IJobInstanceHistoryDao jobInstanceHistoryDao = mock(IJobInstanceHistoryDao.class);

        ReflectionTestUtils.setField(service, "jobMetricsDao", jobMetricsDao);
        ReflectionTestUtils.setField(service, "jobInstanceHistoryDao", jobInstanceHistoryDao);

        JobInstance jobInstance = new JobInstance();
        jobInstance.setId(201L);
        jobInstance.setJobStatus(JobStatus.FINISHED);
        jobInstance.setJobEngineId("");

        JobMetrics jobMetrics = new JobMetrics();
        jobMetrics.setPipelineId(1);
        jobMetrics.setReadRowCount(5L);
        jobMetrics.setWriteRowCount(5L);

        when(jobMetricsDao.getByInstanceId(201L)).thenReturn(Arrays.asList(jobMetrics));
        when(jobInstanceHistoryDao.getByInstanceId(201L)).thenReturn(buildHistoryWithDag(201L));

        List<JobMetrics> result =
                ReflectionTestUtils.invokeMethod(
                        service, "getJobPipelineDetailMetrics", jobInstance);

        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals("Mysql", result.get(0).getSourceTableNames());
        assertEquals("Doris", result.get(0).getSinkTableNames());
    }

    @Test
    public void testGetJobPipelineDetailMetricsRes_UsesEndedJobStatusForDisplay() throws Exception {
        JobMetricsServiceImpl service = new JobMetricsServiceImpl();
        IJobInstanceDao jobInstanceDao = mock(IJobInstanceDao.class);
        IJobMetricsDao jobMetricsDao = mock(IJobMetricsDao.class);
        IJobInstanceHistoryDao jobInstanceHistoryDao = mock(IJobInstanceHistoryDao.class);

        ReflectionTestUtils.setField(service, "jobInstanceDao", jobInstanceDao);
        ReflectionTestUtils.setField(service, "jobMetricsDao", jobMetricsDao);
        ReflectionTestUtils.setField(service, "jobInstanceHistoryDao", jobInstanceHistoryDao);

        User user = new User();
        user.setId(9);
        UserContextHolder.setUserContext(new UserContext(user, 1L, null));

        JobInstance jobInstance = buildEndedJobInstance(301L, "", JobStatus.FINISHED);
        JobMetrics staleMetrics = buildMetric(301L, 20L, 20L);
        staleMetrics.setPipelineId(1);
        staleMetrics.setStatus(JobStatus.FAILED);

        when(jobInstanceDao.getJobInstance(301L)).thenReturn(jobInstance);
        when(jobMetricsDao.getByInstanceId(301L)).thenReturn(Arrays.asList(staleMetrics));
        when(jobInstanceHistoryDao.getByInstanceId(301L)).thenReturn(null);

        List<JobPipelineDetailMetricsRes> result = service.getJobPipelineDetailMetricsRes(301L);

        assertEquals(1, result.size());
        assertEquals(JobStatus.FINISHED, result.get(0).getStatus());
        assertEquals(JobStatus.FAILED, staleMetrics.getStatus());
    }

    private JobInstance buildEndedJobInstance(Long id, String jobEngineId, JobStatus status) {
        JobInstance jobInstance = new JobInstance();
        jobInstance.setId(id);
        jobInstance.setJobEngineId(jobEngineId);
        jobInstance.setJobStatus(status);
        return jobInstance;
    }

    private JobMetrics buildMetric(Long jobInstanceId, long readCount, long writeCount) {
        JobMetrics jobMetrics = new JobMetrics();
        jobMetrics.setJobInstanceId(jobInstanceId);
        jobMetrics.setReadRowCount(readCount);
        jobMetrics.setWriteRowCount(writeCount);
        return jobMetrics;
    }

    private JobInstanceHistory buildHistoryWithDag(Long id) {
        JobInstanceHistory history = new JobInstanceHistory();
        history.setId(id);
        history.setDag(
                JsonUtils.toJsonString(
                        new JobDAG(
                                id,
                                new HashMap<Integer, List<Edge>>() {
                                    {
                                        put(1, Arrays.asList(new Edge(1L, 2L)));
                                    }
                                },
                                new HashMap<Integer, VertexInfo>() {
                                    {
                                        put(1, new VertexInfo(1L, PluginType.SOURCE, "Mysql"));
                                        put(2, new VertexInfo(2L, PluginType.SINK, "Doris"));
                                    }
                                })));
        return history;
    }
}

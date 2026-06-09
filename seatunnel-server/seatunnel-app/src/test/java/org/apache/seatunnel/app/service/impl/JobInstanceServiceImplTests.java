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
import org.apache.seatunnel.app.dal.entity.JobInstance;
import org.apache.seatunnel.app.dal.entity.User;
import org.apache.seatunnel.app.dal.mapper.JobInstanceMapper;
import org.apache.seatunnel.app.security.UserContext;
import org.apache.seatunnel.app.security.UserContextHolder;
import org.apache.seatunnel.app.service.IJobIncrementalService;
import org.apache.seatunnel.app.service.IJobMetricsService;
import org.apache.seatunnel.engine.core.job.JobResult;
import org.apache.seatunnel.engine.core.job.JobStatus;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class JobInstanceServiceImplTests {

    @AfterEach
    public void clearUserContext() {
        UserContextHolder.clear();
    }

    @Test
    public void testComplete_FinishedJobTriggersSlinkMetadataSync() {
        JobInstanceServiceImpl service = new JobInstanceServiceImpl();
        IJobInstanceDao jobInstanceDao = mock(IJobInstanceDao.class);
        JobInstanceMapper jobInstanceMapper = mock(JobInstanceMapper.class);
        IJobMetricsService jobMetricsService = mock(IJobMetricsService.class);
        IJobIncrementalService jobIncrementalService = mock(IJobIncrementalService.class);
        SlinkMetadataSyncService slinkMetadataSyncService = mock(SlinkMetadataSyncService.class);

        ReflectionTestUtils.setField(service, "jobInstanceDao", jobInstanceDao);
        ReflectionTestUtils.setField(service, "jobMetricsService", jobMetricsService);
        ReflectionTestUtils.setField(service, "jobIncrementalService", jobIncrementalService);
        ReflectionTestUtils.setField(service, "slinkMetadataSyncService", slinkMetadataSyncService);

        JobInstance jobInstance = new JobInstance();
        jobInstance.setId(2001L);
        when(jobInstanceDao.getJobInstanceMapper()).thenReturn(jobInstanceMapper);
        when(jobInstanceMapper.selectById(2001L)).thenReturn(jobInstance);

        User user = new User();
        user.setId(9);
        UserContextHolder.setUserContext(new UserContext(user, 1L, null));

        service.complete(2001L, "3001", new JobResult(JobStatus.FINISHED, ""));

        verify(slinkMetadataSyncService).syncFinishedJobMetadata(eq(jobInstance));
        verify(jobIncrementalService).completeExecution(eq(jobInstance), eq(JobStatus.FINISHED));
        verify(jobInstanceDao).update(eq(jobInstance));
    }

    @Test
    public void testComplete_FailedJobDoesNotTriggerSlinkMetadataSync() {
        JobInstanceServiceImpl service = new JobInstanceServiceImpl();
        IJobInstanceDao jobInstanceDao = mock(IJobInstanceDao.class);
        JobInstanceMapper jobInstanceMapper = mock(JobInstanceMapper.class);
        IJobMetricsService jobMetricsService = mock(IJobMetricsService.class);
        IJobIncrementalService jobIncrementalService = mock(IJobIncrementalService.class);
        SlinkMetadataSyncService slinkMetadataSyncService = mock(SlinkMetadataSyncService.class);

        ReflectionTestUtils.setField(service, "jobInstanceDao", jobInstanceDao);
        ReflectionTestUtils.setField(service, "jobMetricsService", jobMetricsService);
        ReflectionTestUtils.setField(service, "jobIncrementalService", jobIncrementalService);
        ReflectionTestUtils.setField(service, "slinkMetadataSyncService", slinkMetadataSyncService);

        JobInstance jobInstance = new JobInstance();
        jobInstance.setId(2002L);
        when(jobInstanceDao.getJobInstanceMapper()).thenReturn(jobInstanceMapper);
        when(jobInstanceMapper.selectById(2002L)).thenReturn(jobInstance);

        User user = new User();
        user.setId(9);
        UserContextHolder.setUserContext(new UserContext(user, 1L, null));

        service.complete(2002L, "3002", new JobResult(JobStatus.FAILED, "boom"));

        verify(slinkMetadataSyncService, never()).syncFinishedJobMetadata(any(JobInstance.class));
        verify(jobIncrementalService).completeExecution(eq(jobInstance), eq(JobStatus.FAILED));
    }
}

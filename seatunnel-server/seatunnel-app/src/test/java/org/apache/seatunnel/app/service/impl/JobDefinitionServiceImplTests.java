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

import org.apache.seatunnel.app.dal.dao.IJobDefinitionDao;
import org.apache.seatunnel.app.dal.dao.IJobTaskDao;
import org.apache.seatunnel.app.dal.entity.User;
import org.apache.seatunnel.app.domain.response.PageInfo;
import org.apache.seatunnel.app.domain.response.job.JobDefinitionRes;
import org.apache.seatunnel.app.security.UserContext;
import org.apache.seatunnel.app.security.UserContextHolder;
import org.apache.seatunnel.common.access.SeatunnelAccessController;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

public class JobDefinitionServiceImplTests {

    @AfterEach
    public void clearUserContext() {
        UserContextHolder.clear();
    }

    @Test
    public void testGetJobPreservesTotalCountFromDao() {
        JobDefinitionServiceImpl service = new JobDefinitionServiceImpl();
        IJobDefinitionDao jobDefinitionDao = mock(IJobDefinitionDao.class);
        IJobTaskDao jobTaskDao = mock(IJobTaskDao.class);
        SeatunnelAccessController accessController = mock(SeatunnelAccessController.class);

        ReflectionTestUtils.setField(service, "jobDefinitionDao", jobDefinitionDao);
        ReflectionTestUtils.setField(service, "jobTaskDao", jobTaskDao);
        ReflectionTestUtils.setField(service, "seatunnelAccessController", accessController);

        JobDefinitionRes definition = new JobDefinitionRes();
        definition.setId(1001L);
        definition.setName("collect-orders");

        PageInfo<JobDefinitionRes> daoPage = new PageInfo<>();
        daoPage.setPageNo(1);
        daoPage.setPageSize(10);
        daoPage.setTotalCount(21);
        daoPage.setData(Collections.singletonList(definition));

        when(jobDefinitionDao.getJob(null, 1, 10, null)).thenReturn(daoPage);
        when(accessController.hasPermission(any(), any(), any(), any())).thenReturn(true);
        when(jobTaskDao.getTasksByVersionIds(any())).thenReturn(Collections.emptyList());

        User user = new User();
        user.setId(1);
        UserContextHolder.setUserContext(new UserContext(user, 1L, null));

        PageInfo<JobDefinitionRes> result = service.getJob(null, 1, 10, null);

        assertEquals(21, result.getTotalCount());
        assertEquals(3, result.getTotalPage());
        assertEquals(1, result.getData().size());
    }
}

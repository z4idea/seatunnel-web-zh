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

import org.apache.seatunnel.app.dal.dao.IUserDao;
import org.apache.seatunnel.app.dal.dao.IWorkspaceDao;
import org.apache.seatunnel.app.dal.entity.JobScheduleConfig;
import org.apache.seatunnel.app.dal.entity.User;
import org.apache.seatunnel.app.dal.entity.Workspace;
import org.apache.seatunnel.app.security.UserContext;
import org.apache.seatunnel.common.access.AccessInfo;
import org.apache.seatunnel.server.common.SeatunnelErrorEnum;
import org.apache.seatunnel.server.common.SeatunnelException;

import org.springframework.stereotype.Component;

import javax.annotation.Resource;

@Component
public class JobScheduleUserContextFactory {

    @Resource private IUserDao userDao;

    @Resource private IWorkspaceDao workspaceDao;

    public UserContext create(JobScheduleConfig config) {
        User user = userDao.getById(config.getUpdateUserId());
        if (user == null) {
            throw new SeatunnelException(
                    SeatunnelErrorEnum.RESOURCE_NOT_FOUND,
                    "Schedule user " + config.getUpdateUserId() + " not found.");
        }
        Workspace workspace = workspaceDao.selectWorkspaceById(config.getWorkspaceId());
        if (workspace == null) {
            throw new SeatunnelException(
                    SeatunnelErrorEnum.RESOURCE_NOT_FOUND,
                    "Workspace " + config.getWorkspaceId() + " not found.");
        }
        AccessInfo accessInfo = new AccessInfo();
        accessInfo.setUsername(user.getUsername());
        accessInfo.setWorkspaceName(workspace.getWorkspaceName());
        return new UserContext(user, config.getWorkspaceId(), accessInfo);
    }
}

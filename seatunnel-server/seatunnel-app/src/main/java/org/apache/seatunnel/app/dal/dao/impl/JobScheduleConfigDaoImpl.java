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

package org.apache.seatunnel.app.dal.dao.impl;

import org.apache.seatunnel.app.dal.dao.IJobScheduleConfigDao;
import org.apache.seatunnel.app.dal.entity.JobScheduleConfig;
import org.apache.seatunnel.app.dal.mapper.JobScheduleConfigMapper;

import org.springframework.stereotype.Repository;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;

import javax.annotation.Resource;

import java.util.List;

import static org.apache.seatunnel.app.utils.ServletUtils.getCurrentWorkspaceId;

@Repository
public class JobScheduleConfigDaoImpl implements IJobScheduleConfigDao {

    @Resource private JobScheduleConfigMapper jobScheduleConfigMapper;

    @Override
    public JobScheduleConfig getById(Long id) {
        return jobScheduleConfigMapper.selectById(id);
    }

    @Override
    public JobScheduleConfig getByJobDefineId(Long jobDefineId) {
        return getByJobDefineId(jobDefineId, getCurrentWorkspaceId());
    }

    @Override
    public JobScheduleConfig getByJobDefineId(Long jobDefineId, Long workspaceId) {
        return jobScheduleConfigMapper.selectOne(
                Wrappers.<JobScheduleConfig>lambdaQuery()
                        .eq(JobScheduleConfig::getJobDefineId, jobDefineId)
                        .eq(JobScheduleConfig::getWorkspaceId, workspaceId));
    }

    @Override
    public List<JobScheduleConfig> listEnabledSchedules() {
        return jobScheduleConfigMapper.selectList(
                Wrappers.<JobScheduleConfig>lambdaQuery().eq(JobScheduleConfig::getEnabled, true));
    }

    @Override
    public void insert(JobScheduleConfig config) {
        jobScheduleConfigMapper.insert(config);
    }

    @Override
    public void update(JobScheduleConfig config) {
        jobScheduleConfigMapper.updateById(config);
    }

    @Override
    public void deleteByJobDefineId(Long jobDefineId) {
        jobScheduleConfigMapper.delete(
                Wrappers.<JobScheduleConfig>lambdaQuery()
                        .eq(JobScheduleConfig::getJobDefineId, jobDefineId)
                        .eq(JobScheduleConfig::getWorkspaceId, getCurrentWorkspaceId()));
    }
}

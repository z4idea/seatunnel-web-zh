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

import org.apache.seatunnel.app.dal.dao.IJobIncrementalRunDao;
import org.apache.seatunnel.app.dal.entity.JobIncrementalRun;
import org.apache.seatunnel.app.dal.mapper.JobIncrementalRunMapper;

import org.springframework.stereotype.Repository;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;

import javax.annotation.Resource;

import java.util.List;

import static org.apache.seatunnel.app.utils.ServletUtils.getCurrentWorkspaceId;

@Repository
public class JobIncrementalRunDaoImpl implements IJobIncrementalRunDao {

    @Resource private JobIncrementalRunMapper jobIncrementalRunMapper;

    @Override
    public void insertRuns(List<JobIncrementalRun> runs) {
        if (runs == null || runs.isEmpty()) {
            return;
        }
        runs.forEach(jobIncrementalRunMapper::insert);
    }

    @Override
    public List<JobIncrementalRun> getByJobInstanceId(Long jobInstanceId, Long workspaceId) {
        return jobIncrementalRunMapper.selectList(
                Wrappers.<JobIncrementalRun>lambdaQuery()
                        .eq(JobIncrementalRun::getJobInstanceId, jobInstanceId)
                        .eq(JobIncrementalRun::getWorkspaceId, workspaceId));
    }

    @Override
    public void deleteByJobInstanceId(Long jobInstanceId, Long workspaceId) {
        jobIncrementalRunMapper.delete(
                Wrappers.<JobIncrementalRun>lambdaQuery()
                        .eq(JobIncrementalRun::getJobInstanceId, jobInstanceId)
                        .eq(JobIncrementalRun::getWorkspaceId, workspaceId));
    }

    @Override
    public void deleteByJobDefineIdAndPluginId(Long jobDefineId, String pluginId) {
        deleteByJobDefineIdAndPluginId(jobDefineId, pluginId, getCurrentWorkspaceId());
    }

    @Override
    public void deleteByJobDefineIdAndPluginId(
            Long jobDefineId, String pluginId, Long workspaceId) {
        jobIncrementalRunMapper.delete(
                Wrappers.<JobIncrementalRun>lambdaQuery()
                        .eq(JobIncrementalRun::getJobDefineId, jobDefineId)
                        .eq(JobIncrementalRun::getPluginId, pluginId)
                        .eq(JobIncrementalRun::getWorkspaceId, workspaceId));
    }
}

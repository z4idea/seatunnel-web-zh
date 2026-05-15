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

package org.apache.seatunnel.app.controller;

import org.apache.seatunnel.app.common.Result;
import org.apache.seatunnel.app.domain.request.job.JobScheduleConfigReq;
import org.apache.seatunnel.app.domain.request.job.JobScheduleEnableReq;
import org.apache.seatunnel.app.domain.response.PageInfo;
import org.apache.seatunnel.app.domain.response.job.JobScheduleConfigRes;
import org.apache.seatunnel.app.domain.response.job.JobScheduleHistoryRes;
import org.apache.seatunnel.app.service.IJobScheduleService;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.annotations.ApiOperation;
import io.swagger.annotations.ApiParam;

import javax.annotation.Resource;

@RestController
@RequestMapping("/seatunnel/api/v1/job/schedule")
public class JobScheduleController {

    @Resource private IJobScheduleService jobScheduleService;

    @GetMapping
    @ApiOperation(value = "get job schedule config", httpMethod = "GET")
    Result<JobScheduleConfigRes> getJobSchedule(
            @ApiParam(value = "job define id", required = true) @RequestParam Long jobDefineId) {
        return Result.success(jobScheduleService.getJobSchedule(jobDefineId));
    }

    @PutMapping
    @ApiOperation(value = "create or update job schedule config", httpMethod = "PUT")
    Result<JobScheduleConfigRes> saveJobSchedule(@RequestBody JobScheduleConfigReq req) {
        return Result.success(jobScheduleService.saveJobSchedule(req));
    }

    @PatchMapping("/enable")
    @ApiOperation(value = "enable or disable job schedule", httpMethod = "PATCH")
    Result<JobScheduleConfigRes> updateJobScheduleEnabled(@RequestBody JobScheduleEnableReq req) {
        return Result.success(jobScheduleService.updateJobScheduleEnabled(req));
    }

    @GetMapping("/history")
    @ApiOperation(value = "get job schedule history", httpMethod = "GET")
    Result<PageInfo<JobScheduleHistoryRes>> getJobScheduleHistory(
            @ApiParam(value = "job define id", required = true) @RequestParam Long jobDefineId,
            @ApiParam(value = "page num", required = true) @RequestParam Integer pageNo,
            @ApiParam(value = "page size", required = true) @RequestParam Integer pageSize) {
        return Result.success(
                jobScheduleService.getJobScheduleHistory(jobDefineId, pageNo, pageSize));
    }
}

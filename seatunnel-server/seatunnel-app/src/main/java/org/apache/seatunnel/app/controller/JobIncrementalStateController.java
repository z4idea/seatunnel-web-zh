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
import org.apache.seatunnel.app.domain.request.job.JobIncrementalStateResetReq;
import org.apache.seatunnel.app.domain.response.job.JobIncrementalStateRes;
import org.apache.seatunnel.app.service.IJobIncrementalService;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.annotations.ApiOperation;

import javax.annotation.Resource;

@RestController
@RequestMapping("/seatunnel/api/v1/job/incremental-state")
public class JobIncrementalStateController {

    @Resource private IJobIncrementalService jobIncrementalService;

    @GetMapping
    @ApiOperation(value = "get incremental state", httpMethod = "GET")
    public Result<JobIncrementalStateRes> getState(
            @RequestParam("jobDefineId") Long jobDefineId,
            @RequestParam("pluginId") String pluginId) {
        return Result.success(jobIncrementalService.getIncrementalState(jobDefineId, pluginId));
    }

    @PostMapping("/reset")
    @ApiOperation(value = "reset incremental state", httpMethod = "POST")
    public Result<Void> resetState(@RequestBody JobIncrementalStateResetReq req) {
        jobIncrementalService.resetIncrementalState(req.getJobDefineId(), req.getPluginId());
        return Result.success();
    }
}

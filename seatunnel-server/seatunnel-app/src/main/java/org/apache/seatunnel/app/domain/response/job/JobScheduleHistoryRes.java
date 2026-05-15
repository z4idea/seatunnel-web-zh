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

package org.apache.seatunnel.app.domain.response.job;

import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Builder;
import lombok.Data;

import java.util.Date;

@Data
@Builder
@ApiModel(value = "jobScheduleHistoryResponse", description = "job schedule history response")
public class JobScheduleHistoryRes {

    @ApiModelProperty(value = "history id", dataType = "Long")
    private Long id;

    @ApiModelProperty(value = "schedule config id", dataType = "Long")
    private Long scheduleConfigId;

    @ApiModelProperty(value = "job define id", dataType = "Long")
    private Long jobDefineId;

    @ApiModelProperty(value = "trigger time", dataType = "Date")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private Date triggerTime;

    @ApiModelProperty(value = "status", dataType = "String")
    private String status;

    @ApiModelProperty(value = "message", dataType = "String")
    private String message;

    @ApiModelProperty(value = "job instance id", dataType = "Long")
    private Long jobInstanceId;

    @ApiModelProperty(value = "create time", dataType = "Date")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private Date createTime;
}

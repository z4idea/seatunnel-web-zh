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

package org.apache.seatunnel.app.dal.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@TableName("t_st_job_schedule_history")
public class JobScheduleHistory {

    @TableId(value = "id", type = IdType.INPUT)
    private Long id;

    @TableField("schedule_config_id")
    private Long scheduleConfigId;

    @TableField("job_define_id")
    private Long jobDefineId;

    @TableField("trigger_time")
    private Date triggerTime;

    @TableField("status")
    private String status;

    @TableField("message")
    private String message;

    @TableField("job_instance_id")
    private Long jobInstanceId;

    @TableField("create_time")
    private Date createTime;

    @TableField("workspace_id")
    private Long workspaceId;
}

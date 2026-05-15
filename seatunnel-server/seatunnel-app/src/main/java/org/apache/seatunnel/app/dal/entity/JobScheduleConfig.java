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
@TableName("t_st_job_schedule_config")
public class JobScheduleConfig {

    @TableId(value = "id", type = IdType.INPUT)
    private Long id;

    @TableField("job_define_id")
    private Long jobDefineId;

    @TableField("cron_expression")
    private String cronExpression;

    @TableField("enabled")
    private Boolean enabled;

    @TableField("active_start_time")
    private Date activeStartTime;

    @TableField("active_end_time")
    private Date activeEndTime;

    @TableField("last_trigger_time")
    private Date lastTriggerTime;

    @TableField("next_trigger_time")
    private Date nextTriggerTime;

    @TableField("last_schedule_status")
    private String lastScheduleStatus;

    @TableField("last_schedule_message")
    private String lastScheduleMessage;

    @TableField("create_user_id")
    private Integer createUserId;

    @TableField("update_user_id")
    private Integer updateUserId;

    @TableField("create_time")
    private Date createTime;

    @TableField("update_time")
    private Date updateTime;

    @TableField("workspace_id")
    private Long workspaceId;
}

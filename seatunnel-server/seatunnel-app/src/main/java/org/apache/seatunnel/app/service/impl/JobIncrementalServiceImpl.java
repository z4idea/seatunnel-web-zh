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

package org.apache.seatunnel.app.service.impl;

import org.apache.seatunnel.shade.com.typesafe.config.Config;
import org.apache.seatunnel.shade.com.typesafe.config.ConfigFactory;

import org.apache.seatunnel.app.common.JdbcIncrementalColumnType;
import org.apache.seatunnel.app.common.JdbcIncrementalExtractMode;
import org.apache.seatunnel.app.dal.dao.IJobDefinitionDao;
import org.apache.seatunnel.app.dal.dao.IJobIncrementalRunDao;
import org.apache.seatunnel.app.dal.dao.IJobIncrementalStateDao;
import org.apache.seatunnel.app.dal.dao.IJobInstanceDao;
import org.apache.seatunnel.app.dal.entity.JobDefinition;
import org.apache.seatunnel.app.dal.entity.JobIncrementalRun;
import org.apache.seatunnel.app.dal.entity.JobIncrementalState;
import org.apache.seatunnel.app.dal.entity.JobInstance;
import org.apache.seatunnel.app.dal.entity.JobTask;
import org.apache.seatunnel.app.domain.request.connector.SceneMode;
import org.apache.seatunnel.app.domain.request.job.DataSourceOption;
import org.apache.seatunnel.app.domain.response.datasource.DatasourceDetailRes;
import org.apache.seatunnel.app.domain.response.job.JobIncrementalStateRes;
import org.apache.seatunnel.app.security.UserContextHolder;
import org.apache.seatunnel.app.service.IDatasourceService;
import org.apache.seatunnel.app.service.IJobIncrementalService;
import org.apache.seatunnel.app.utils.JobIncrementalUtils;
import org.apache.seatunnel.app.utils.ServletUtils;
import org.apache.seatunnel.common.access.AccessType;
import org.apache.seatunnel.common.access.ResourceType;
import org.apache.seatunnel.common.constants.PluginType;
import org.apache.seatunnel.common.utils.JsonUtils;
import org.apache.seatunnel.engine.core.job.JobStatus;
import org.apache.seatunnel.server.common.CodeGenerateUtils;
import org.apache.seatunnel.server.common.SeatunnelErrorEnum;
import org.apache.seatunnel.server.common.SeatunnelException;

import org.apache.commons.lang3.StringUtils;

import org.springframework.stereotype.Service;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.Resource;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Slf4j
@Service
public class JobIncrementalServiceImpl extends SeatunnelBaseServiceImpl
        implements IJobIncrementalService {

    public static final String INCREMENTAL_RUNNING_MESSAGE_TOKEN = "already has a running instance";

    private static final String EXTRACT_MODE = "extract_mode";
    private static final String INCREMENTAL_COLUMN = "incremental_column";
    private static final String INCREMENTAL_COLUMN_TYPE = "incremental_column_type";
    private static final String WHERE_CONDITION = "where_condition";

    @Resource private IJobIncrementalStateDao jobIncrementalStateDao;

    @Resource private IJobIncrementalRunDao jobIncrementalRunDao;

    @Resource private IJobInstanceDao jobInstanceDao;

    @Resource private IJobDefinitionDao jobDefinitionDao;

    @Resource private IDatasourceService datasourceService;

    @Override
    public boolean hasIncrementalSource(List<JobTask> tasks) {
        for (JobTask task : tasks) {
            if (parseIncrementalTaskConfig(task).isIncrementalEnabled()) {
                return true;
            }
        }
        return false;
    }

    @Override
    public void validateNoConcurrentExecution(Long jobDefineId) {
        if (jobInstanceDao.existsRunningJobInstance(jobDefineId)) {
            JobDefinition jobDefinition = jobDefinitionDao.getJob(jobDefineId);
            String jobName =
                    jobDefinition == null ? String.valueOf(jobDefineId) : jobDefinition.getName();
            throw new SeatunnelException(
                    SeatunnelErrorEnum.INVALID_OPERATION,
                    "incremental job [" + jobName + "] " + INCREMENTAL_RUNNING_MESSAGE_TOKEN);
        }
    }

    @Override
    public Map<String, String> prepareExecution(
            Long jobDefineId, Long jobInstanceId, List<JobTask> tasks) {
        int userId = ServletUtils.getCurrentUserId();
        Long workspaceId = ServletUtils.getCurrentWorkspaceId();
        List<JobIncrementalRun> pendingRuns = new ArrayList<>();
        Map<String, String> whereOverrides = new java.util.HashMap<>();

        for (JobTask task : tasks) {
            IncrementalTaskConfig incrementalTaskConfig = parseIncrementalTaskConfig(task);
            if (!incrementalTaskConfig.isIncrementalEnabled()) {
                continue;
            }

            DataSourceOption dataSourceOption = requireSingleTableOption(task);
            DatasourceDetailRes datasourceDetailRes =
                    datasourceService.queryDatasourceDetailById(task.getDataSourceId().toString());
            JdbcIncrementalDialect dialect =
                    JdbcIncrementalDialect.fromDatasourceName(datasourceDetailRes.getPluginName());
            JobIncrementalState currentState =
                    jobIncrementalStateDao.getByJobDefineIdAndPluginId(
                            jobDefineId, task.getPluginId());
            String lowerBound = currentState == null ? null : currentState.getLastSuccessValue();
            String upperBound =
                    queryUpperBound(
                            datasourceDetailRes, dataSourceOption, incrementalTaskConfig, dialect);

            String whereCondition =
                    JobIncrementalUtils.buildWhereCondition(
                            incrementalTaskConfig.getWhereCondition(),
                            dialect.quoteIdentifier(incrementalTaskConfig.getIncrementalColumn()),
                            lowerBound,
                            upperBound,
                            incrementalTaskConfig.getIncrementalColumnType());
            whereOverrides.put(task.getPluginId(), whereCondition);
            pendingRuns.add(
                    buildPendingRun(
                            jobDefineId,
                            jobInstanceId,
                            task,
                            incrementalTaskConfig,
                            lowerBound,
                            upperBound,
                            userId,
                            workspaceId));
        }

        jobIncrementalRunDao.insertRuns(pendingRuns);
        return whereOverrides;
    }

    @Override
    public void cleanupExecutionPreparation(Long jobInstanceId, Long workspaceId) {
        jobIncrementalRunDao.deleteByJobInstanceId(jobInstanceId, workspaceId);
    }

    @Override
    public void completeExecution(JobInstance jobInstance, JobStatus jobStatus) {
        List<JobIncrementalRun> pendingRuns =
                jobIncrementalRunDao.getByJobInstanceId(
                        jobInstance.getId(), jobInstance.getWorkspaceId());
        if (pendingRuns.isEmpty()) {
            return;
        }
        try {
            if (JobStatus.FINISHED == jobStatus) {
                pendingRuns.forEach(run -> advanceCommittedState(jobInstance, run));
            }
        } finally {
            jobIncrementalRunDao.deleteByJobInstanceId(
                    jobInstance.getId(), jobInstance.getWorkspaceId());
        }
    }

    @Override
    public JobIncrementalStateRes getIncrementalState(Long jobDefineId, String pluginId) {
        validateJobAccess(jobDefineId, AccessType.READ);
        validateJobDefineIdAndPluginId(jobDefineId, pluginId);
        JobIncrementalState state =
                jobIncrementalStateDao.getByJobDefineIdAndPluginId(jobDefineId, pluginId);
        if (state == null) {
            return JobIncrementalStateRes.builder()
                    .jobDefineId(jobDefineId)
                    .pluginId(pluginId)
                    .build();
        }
        return JobIncrementalStateRes.builder()
                .jobDefineId(jobDefineId)
                .pluginId(pluginId)
                .incrementalColumn(state.getIncrementalColumn())
                .incrementalColumnType(state.getIncrementalColumnType())
                .lastSuccessValue(state.getLastSuccessValue())
                .updateTime(state.getUpdateTime())
                .build();
    }

    @Override
    public void resetIncrementalState(Long jobDefineId, String pluginId) {
        validateJobAccess(jobDefineId, AccessType.EXECUTE);
        validateJobDefineIdAndPluginId(jobDefineId, pluginId);
        jobIncrementalStateDao.deleteByJobDefineIdAndPluginId(jobDefineId, pluginId);
        jobIncrementalRunDao.deleteByJobDefineIdAndPluginId(jobDefineId, pluginId);
    }

    @Override
    public void resetStateOnTaskChange(Long jobDefineId, JobTask oldTask, JobTask newTask) {
        if (oldTask == null || newTask == null) {
            return;
        }
        IncrementalTaskConfig oldConfig = parseIncrementalTaskConfig(oldTask);
        IncrementalTaskConfig newConfig = parseIncrementalTaskConfig(newTask);
        if (!oldConfig.isStateManaged() && !newConfig.isStateManaged()) {
            return;
        }
        if (hasStateRelevantChange(oldTask, newTask, oldConfig, newConfig)) {
            jobIncrementalStateDao.deleteByJobDefineIdAndPluginId(
                    jobDefineId, oldTask.getPluginId());
            jobIncrementalRunDao.deleteByJobDefineIdAndPluginId(jobDefineId, oldTask.getPluginId());
            if (!StringUtils.equals(oldTask.getPluginId(), newTask.getPluginId())) {
                jobIncrementalStateDao.deleteByJobDefineIdAndPluginId(
                        jobDefineId, newTask.getPluginId());
                jobIncrementalRunDao.deleteByJobDefineIdAndPluginId(
                        jobDefineId, newTask.getPluginId());
            }
        }
    }

    @Override
    public void deleteStateForTask(Long jobDefineId, JobTask task) {
        if (task == null || StringUtils.isBlank(task.getPluginId())) {
            return;
        }
        jobIncrementalStateDao.deleteByJobDefineIdAndPluginId(jobDefineId, task.getPluginId());
        jobIncrementalRunDao.deleteByJobDefineIdAndPluginId(jobDefineId, task.getPluginId());
    }

    private void advanceCommittedState(JobInstance jobInstance, JobIncrementalRun pendingRun) {
        JdbcIncrementalColumnType columnType =
                JdbcIncrementalColumnType.valueOf(pendingRun.getIncrementalColumnType());
        JobIncrementalState existingState =
                jobIncrementalStateDao.getByJobDefineIdAndPluginId(
                        pendingRun.getJobDefineId(),
                        pendingRun.getPluginId(),
                        jobInstance.getWorkspaceId());
        if (!JobIncrementalUtils.shouldAdvance(
                existingState == null ? null : existingState.getLastSuccessValue(),
                pendingRun.getUpperBound(),
                columnType)) {
            return;
        }

        if (existingState == null) {
            existingState =
                    JobIncrementalState.builder()
                            .id(generateId())
                            .jobDefineId(pendingRun.getJobDefineId())
                            .pluginId(pendingRun.getPluginId())
                            .incrementalColumn(pendingRun.getIncrementalColumn())
                            .incrementalColumnType(pendingRun.getIncrementalColumnType())
                            .lastSuccessValue(pendingRun.getUpperBound())
                            .createUserId(jobInstance.getCreateUserId())
                            .updateUserId(jobInstance.getUpdateUserId())
                            .workspaceId(jobInstance.getWorkspaceId())
                            .build();
            jobIncrementalStateDao.insert(existingState);
            return;
        }

        existingState.setIncrementalColumn(pendingRun.getIncrementalColumn());
        existingState.setIncrementalColumnType(pendingRun.getIncrementalColumnType());
        existingState.setLastSuccessValue(pendingRun.getUpperBound());
        existingState.setUpdateUserId(jobInstance.getUpdateUserId());
        existingState.setWorkspaceId(jobInstance.getWorkspaceId());
        jobIncrementalStateDao.update(existingState);
    }

    private JobIncrementalRun buildPendingRun(
            Long jobDefineId,
            Long jobInstanceId,
            JobTask task,
            IncrementalTaskConfig incrementalTaskConfig,
            String lowerBound,
            String upperBound,
            int userId,
            Long workspaceId) {
        return JobIncrementalRun.builder()
                .id(generateId())
                .jobInstanceId(jobInstanceId)
                .jobDefineId(jobDefineId)
                .pluginId(task.getPluginId())
                .incrementalColumn(incrementalTaskConfig.getIncrementalColumn())
                .incrementalColumnType(incrementalTaskConfig.getIncrementalColumnType().name())
                .lowerBound(lowerBound)
                .upperBound(upperBound)
                .createUserId(userId)
                .updateUserId(userId)
                .workspaceId(workspaceId)
                .build();
    }

    private String queryUpperBound(
            DatasourceDetailRes datasourceDetailRes,
            DataSourceOption dataSourceOption,
            IncrementalTaskConfig incrementalTaskConfig,
            JdbcIncrementalDialect dialect) {
        Map<String, String> datasourceConfig = datasourceDetailRes.getDatasourceConfig();
        String url = datasourceConfig.get("url");
        String user = datasourceConfig.get("user");
        String password = datasourceConfig.get("password");
        String driverClassName =
                StringUtils.defaultIfBlank(
                        datasourceConfig.get("driver"), dialect.getDriverClassName());

        String sql =
                buildUpperBoundSql(
                        dialect,
                        dataSourceOption.getDatabases().get(0),
                        dataSourceOption.getTables().get(0),
                        incrementalTaskConfig);

        try {
            Class.forName(driverClassName);
            try (Connection connection = DriverManager.getConnection(url, user, password);
                    Statement statement = connection.createStatement();
                    ResultSet resultSet = statement.executeQuery(sql)) {
                if (!resultSet.next()) {
                    return null;
                }
                return JobIncrementalUtils.toStoredValue(
                        resultSet.getObject(1), incrementalTaskConfig.getIncrementalColumnType());
            }
        } catch (Exception e) {
            throw new SeatunnelException(
                    SeatunnelErrorEnum.ILLEGAL_STATE,
                    String.format(
                            "Query incremental upper bound failed for datasource [%s]: %s",
                            datasourceDetailRes.getDatasourceName(), e.getMessage()));
        }
    }

    private String buildUpperBoundSql(
            JdbcIncrementalDialect dialect,
            String databaseName,
            String tableName,
            IncrementalTaskConfig incrementalTaskConfig) {
        StringBuilder sql =
                new StringBuilder()
                        .append("SELECT MAX(")
                        .append(
                                dialect.quoteIdentifier(
                                        incrementalTaskConfig.getIncrementalColumn()))
                        .append(") FROM ")
                        .append(dialect.buildTableReference(databaseName, tableName));

        String normalizedStaticWhere =
                JobIncrementalUtils.stripLeadingWhere(incrementalTaskConfig.getWhereCondition());
        if (StringUtils.isNotBlank(normalizedStaticWhere)) {
            sql.append(" WHERE ").append(normalizedStaticWhere);
        }
        return sql.toString();
    }

    private DataSourceOption requireSingleTableOption(JobTask task) {
        if (!PluginType.SOURCE.name().equalsIgnoreCase(task.getType())
                || !SceneMode.SINGLE_TABLE.name().equalsIgnoreCase(task.getSceneMode())) {
            throw new SeatunnelException(
                    SeatunnelErrorEnum.ERROR_CONFIG,
                    String.format(
                            "Incremental extraction only supports JDBC single-table source, pluginId=%s",
                            task.getPluginId()));
        }
        DataSourceOption dataSourceOption =
                StringUtils.isBlank(task.getDataSourceOption())
                        ? null
                        : JsonUtils.parseObject(task.getDataSourceOption(), DataSourceOption.class);
        if (dataSourceOption == null
                || dataSourceOption.getDatabases() == null
                || dataSourceOption.getDatabases().size() != 1
                || dataSourceOption.getTables() == null
                || dataSourceOption.getTables().size() != 1) {
            throw new SeatunnelException(
                    SeatunnelErrorEnum.ERROR_CONFIG,
                    String.format(
                            "Incremental extraction requires exactly one database and one table, pluginId=%s",
                            task.getPluginId()));
        }
        return dataSourceOption;
    }

    private IncrementalTaskConfig parseIncrementalTaskConfig(JobTask task) {
        if (!PluginType.SOURCE.name().equalsIgnoreCase(task.getType())) {
            return IncrementalTaskConfig.disabled();
        }
        Config config =
                StringUtils.isBlank(task.getConfig())
                        ? ConfigFactory.empty()
                        : ConfigFactory.parseString(task.getConfig());

        JdbcIncrementalExtractMode extractMode =
                JdbcIncrementalExtractMode.valueOf(
                        config.hasPath(EXTRACT_MODE)
                                ? config.getString(EXTRACT_MODE).toUpperCase(Locale.ROOT)
                                : JdbcIncrementalExtractMode.FULL.name());
        String whereCondition =
                config.hasPath(WHERE_CONDITION) ? config.getString(WHERE_CONDITION) : null;
        String incrementalColumn =
                config.hasPath(INCREMENTAL_COLUMN) ? config.getString(INCREMENTAL_COLUMN) : null;
        String incrementalColumnTypeValue =
                config.hasPath(INCREMENTAL_COLUMN_TYPE)
                        ? config.getString(INCREMENTAL_COLUMN_TYPE)
                        : null;
        JdbcIncrementalColumnType incrementalColumnType =
                StringUtils.isBlank(incrementalColumnTypeValue)
                        ? null
                        : JdbcIncrementalColumnType.valueOf(
                                incrementalColumnTypeValue.toUpperCase(Locale.ROOT));

        if (extractMode != JdbcIncrementalExtractMode.INCREMENTAL) {
            return new IncrementalTaskConfig(extractMode, null, null, whereCondition);
        }
        if (StringUtils.isBlank(incrementalColumn) || incrementalColumnType == null) {
            throw new SeatunnelException(
                    SeatunnelErrorEnum.ERROR_CONFIG,
                    String.format(
                            "Incremental extraction requires incremental_column and incremental_column_type, pluginId=%s",
                            task.getPluginId()));
        }
        return new IncrementalTaskConfig(
                extractMode, incrementalColumn.trim(), incrementalColumnType, whereCondition);
    }

    private boolean hasStateRelevantChange(
            JobTask oldTask,
            JobTask newTask,
            IncrementalTaskConfig oldConfig,
            IncrementalTaskConfig newConfig) {
        if (!StringUtils.equals(oldTask.getSceneMode(), newTask.getSceneMode())) {
            return true;
        }
        if (!java.util.Objects.equals(oldTask.getDataSourceId(), newTask.getDataSourceId())) {
            return true;
        }
        if (!StringUtils.equals(
                normalizeTableOption(oldTask.getDataSourceOption()),
                normalizeTableOption(newTask.getDataSourceOption()))) {
            return true;
        }
        return !StringUtils.equals(
                        StringUtils.trimToNull(oldConfig.getWhereCondition()),
                        StringUtils.trimToNull(newConfig.getWhereCondition()))
                || oldConfig.getExtractMode() != newConfig.getExtractMode()
                || !StringUtils.equals(
                        oldConfig.getIncrementalColumn(), newConfig.getIncrementalColumn())
                || oldConfig.getIncrementalColumnType() != newConfig.getIncrementalColumnType();
    }

    private String normalizeTableOption(String dataSourceOption) {
        if (StringUtils.isBlank(dataSourceOption)) {
            return null;
        }
        return JsonUtils.toJsonString(
                JsonUtils.parseObject(dataSourceOption, DataSourceOption.class));
    }

    private void validateJobAccess(Long jobDefineId, AccessType accessType) {
        if (jobDefineId == null) {
            throw new SeatunnelException(SeatunnelErrorEnum.PARAM_CAN_NOT_BE_NULL, "jobDefineId");
        }
        JobDefinition jobDefinition = jobDefinitionDao.getJob(jobDefineId);
        if (jobDefinition == null) {
            throw new SeatunnelException(
                    SeatunnelErrorEnum.RESOURCE_NOT_FOUND, "job definition not found.");
        }
        permissionCheck(
                jobDefinition.getName(),
                ResourceType.JOB,
                accessType,
                UserContextHolder.getAccessInfo());
    }

    private void validateJobDefineIdAndPluginId(Long jobDefineId, String pluginId) {
        if (jobDefineId == null) {
            throw new SeatunnelException(SeatunnelErrorEnum.PARAM_CAN_NOT_BE_NULL, "jobDefineId");
        }
        if (StringUtils.isBlank(pluginId)) {
            throw new SeatunnelException(SeatunnelErrorEnum.PARAM_CAN_NOT_BE_NULL, "pluginId");
        }
    }

    private long generateId() {
        try {
            return CodeGenerateUtils.getInstance().genCode();
        } catch (CodeGenerateUtils.CodeGenerateException e) {
            throw new SeatunnelException(SeatunnelErrorEnum.JOB_RUN_GENERATE_UUID_ERROR);
        }
    }

    @Data
    @AllArgsConstructor
    private static class IncrementalTaskConfig {
        private JdbcIncrementalExtractMode extractMode;
        private String incrementalColumn;
        private JdbcIncrementalColumnType incrementalColumnType;
        private String whereCondition;

        static IncrementalTaskConfig disabled() {
            return new IncrementalTaskConfig(JdbcIncrementalExtractMode.FULL, null, null, null);
        }

        boolean isIncrementalEnabled() {
            return extractMode == JdbcIncrementalExtractMode.INCREMENTAL;
        }

        boolean isStateManaged() {
            return isIncrementalEnabled()
                    || StringUtils.isNotBlank(incrementalColumn)
                    || incrementalColumnType != null;
        }
    }

    private enum JdbcIncrementalDialect {
        MYSQL("JDBC-MYSQL", "com.mysql.cj.jdbc.Driver") {
            @Override
            String quoteIdentifier(String identifier) {
                return "`" + identifier + "`";
            }

            @Override
            String buildTableReference(String databaseName, String tableName) {
                return quoteIdentifier(databaseName) + "." + quoteIdentifier(tableName);
            }
        },
        POSTGRES("JDBC-POSTGRES", "org.postgresql.Driver") {
            @Override
            String quoteIdentifier(String identifier) {
                return "\"" + identifier + "\"";
            }

            @Override
            String buildTableReference(String databaseName, String tableName) {
                String[] split = splitSchemaAndTable(tableName, "postgres");
                return quoteIdentifier(databaseName)
                        + "."
                        + quoteIdentifier(split[0])
                        + "."
                        + quoteIdentifier(split[1]);
            }
        },
        SQLSERVER("JDBC-SQLSERVER", "com.microsoft.sqlserver.jdbc.SQLServerDriver") {
            @Override
            String quoteIdentifier(String identifier) {
                return "[" + identifier + "]";
            }

            @Override
            String buildTableReference(String databaseName, String tableName) {
                String[] split = splitSchemaAndTable(tableName, "sqlserver");
                return quoteIdentifier(databaseName)
                        + "."
                        + quoteIdentifier(split[0])
                        + "."
                        + quoteIdentifier(split[1]);
            }
        };

        private final String datasourceName;
        private final String driverClassName;

        JdbcIncrementalDialect(String datasourceName, String driverClassName) {
            this.datasourceName = datasourceName;
            this.driverClassName = driverClassName;
        }

        abstract String quoteIdentifier(String identifier);

        abstract String buildTableReference(String databaseName, String tableName);

        String getDriverClassName() {
            return driverClassName;
        }

        static JdbcIncrementalDialect fromDatasourceName(String datasourceName) {
            for (JdbcIncrementalDialect value : values()) {
                if (value.datasourceName.equalsIgnoreCase(datasourceName)) {
                    return value;
                }
            }
            throw new SeatunnelException(
                    SeatunnelErrorEnum.ERROR_CONFIG,
                    String.format(
                            "Incremental extraction only supports JDBC-Mysql/JDBC-Postgres/JDBC-SQLServer, datasource=%s",
                            datasourceName));
        }

        String[] splitSchemaAndTable(String fullTableName, String datasource) {
            String[] split = fullTableName.split("\\.");
            if (split.length != 2) {
                throw new SeatunnelException(
                        SeatunnelErrorEnum.ERROR_CONFIG,
                        String.format(
                                "The table name for %s must be schema.table, but got [%s]",
                                datasource, fullTableName));
            }
            return split;
        }
    }
}

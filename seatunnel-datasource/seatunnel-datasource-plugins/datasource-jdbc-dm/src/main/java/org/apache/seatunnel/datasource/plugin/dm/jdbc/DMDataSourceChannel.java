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

package org.apache.seatunnel.datasource.plugin.dm.jdbc;

import org.apache.seatunnel.api.configuration.util.OptionRule;
import org.apache.seatunnel.common.utils.SeaTunnelException;
import org.apache.seatunnel.datasource.plugin.api.DataSourceChannel;
import org.apache.seatunnel.datasource.plugin.api.DataSourcePluginException;
import org.apache.seatunnel.datasource.plugin.api.model.TableField;
import org.apache.seatunnel.datasource.plugin.api.utils.JdbcUtils;

import org.apache.commons.lang3.StringUtils;

import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.google.common.base.Preconditions.checkNotNull;

@Slf4j
public class DMDataSourceChannel implements DataSourceChannel {

    @Override
    public OptionRule getDataSourceOptions(@NonNull String pluginName) {
        return DMDataSourceConfig.OPTION_RULE;
    }

    @Override
    public OptionRule getDatasourceMetadataFieldsByDataSourceName(@NonNull String pluginName) {
        return DMDataSourceConfig.METADATA_RULE;
    }

    @Override
    public List<String> getTables(
            @NonNull String pluginName,
            Map<String, String> requestParams,
            String database,
            Map<String, String> options) {
        String normalizedDatabase = normalizeIdentifier(database);
        String filterName = StringUtils.trimToEmpty(options.get("filterName"));
        Integer size = parsePositiveInteger(options.get("size"));

        StringBuilder sql = new StringBuilder();
        List<String> parameters = new ArrayList<>();

        sql.append("SELECT OWNER, TABLE_NAME FROM SYS.DBA_TABLES WHERE 1=1 ")
                .append("AND OWNER NOT IN ('SYS', 'SYSTEM', 'SYSAUDITOR', 'SYSSSO', 'SYSDBA')");

        if (StringUtils.isNotBlank(normalizedDatabase)) {
            sql.append(" AND OWNER = ?");
            parameters.add(normalizedDatabase);
        }

        if (StringUtils.isNotBlank(filterName)) {
            String[] split = filterName.split("\\.", 2);
            if (split.length == 2) {
                sql.append(" AND OWNER LIKE ? AND TABLE_NAME LIKE ?");
                parameters.add(buildLikePattern(split[0]));
                parameters.add(buildLikePattern(split[1]));
            } else {
                String pattern = buildLikePattern(filterName);
                sql.append(" AND (OWNER LIKE ? OR TABLE_NAME LIKE ?)");
                parameters.add(pattern);
                parameters.add(pattern);
            }
        }

        sql.append(" ORDER BY OWNER, TABLE_NAME");

        if (size != null) {
            sql.insert(0, "SELECT * FROM (").append(") WHERE ROWNUM <= ?");
            parameters.add(String.valueOf(size));
        }
        log.info(
                "execute dm getTables, database={}, filterName={}, size={}",
                database,
                filterName,
                size);
        List<String> tableNames = new ArrayList<>();
        long start = System.currentTimeMillis();
        try (Connection connection = getConnection(requestParams);
                PreparedStatement statement = connection.prepareStatement(sql.toString())) {
            for (int i = 0; i < parameters.size(); i++) {
                statement.setString(i + 1, parameters.get(i));
            }
            long end = System.currentTimeMillis();
            log.info("connection, cost {}ms for dm", end - start);
            start = System.currentTimeMillis();
            try (ResultSet resultSet = statement.executeQuery()) {
                end = System.currentTimeMillis();
                log.info("statement execute sql, cost {}ms for dm", end - start);
                start = System.currentTimeMillis();
                while (resultSet.next()) {
                    String schemaName = resultSet.getString("OWNER");
                    String tableName = resultSet.getString("TABLE_NAME");
                    tableNames.add(schemaName + "." + tableName);
                }
                end = System.currentTimeMillis();
                log.info("while result set, cost {}ms for dm", end - start);
            }
            return tableNames;
        } catch (ClassNotFoundException | SQLException e) {
            throw new DataSourcePluginException("get table names failed", e);
        }
    }

    @Override
    public List<String> getDatabases(
            @NonNull String pluginName, @NonNull Map<String, String> requestParams) {
        List<String> dbNames = new ArrayList<>();
        try (Connection connection = getConnection(requestParams);
                PreparedStatement statement =
                        connection.prepareStatement(
                                "SELECT USERNAME FROM SYS.DBA_USERS " + "ORDER BY USERNAME");
                ResultSet re = statement.executeQuery()) {
            while (re.next()) {
                String dbName = re.getString("USERNAME");
                if (StringUtils.isNotBlank(dbName) && isNotSystemSchema(dbName)) {
                    dbNames.add(dbName);
                }
            }
            return dbNames;
        } catch (Exception ex) {
            throw new RuntimeException("get schemas failed", ex);
        }
    }

    @Override
    public boolean checkDataSourceConnectivity(
            @NonNull String pluginName, @NonNull Map<String, String> requestParams) {
        try (Connection ignored = getConnection(requestParams)) {
            return true;
        } catch (Exception e) {
            throw new DataSourcePluginException("check jdbc connectivity failed", e);
        }
    }

    @Override
    public List<TableField> getTableFields(
            @NonNull String pluginName,
            @NonNull Map<String, String> requestParams,
            @NonNull String database,
            @NonNull String table) {
        String[] split = splitTableName(table);
        String schemaName = normalizeIdentifier(split[0]);
        String tableName = normalizeIdentifier(split[1]);

        List<TableField> tableFields = new ArrayList<>();
        String columnSql =
                "SELECT c.COLUMN_NAME, c.DATA_TYPE, c.DATA_DEFAULT, c.NULLABLE, cc.COMMENTS "
                        + "FROM ALL_TAB_COLUMNS c "
                        + "LEFT JOIN ALL_COL_COMMENTS cc "
                        + "ON c.OWNER = cc.OWNER "
                        + "AND c.TABLE_NAME = cc.TABLE_NAME "
                        + "AND c.COLUMN_NAME = cc.COLUMN_NAME "
                        + "WHERE c.OWNER = ? AND c.TABLE_NAME = ? "
                        + "ORDER BY c.COLUMN_ID";
        try (Connection connection = getConnection(requestParams);
                PreparedStatement statement = connection.prepareStatement(columnSql)) {
            Set<String> primaryKeys =
                    getPrimaryKeys(connection.getMetaData(), schemaName, tableName);
            statement.setString(1, schemaName);
            statement.setString(2, tableName);
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    TableField tableField = new TableField();
                    String columnName = resultSet.getString("COLUMN_NAME");
                    tableField.setPrimaryKey(primaryKeys.contains(columnName));
                    tableField.setName(columnName);
                    tableField.setType(resultSet.getString("DATA_TYPE"));
                    tableField.setComment(resultSet.getString("COMMENTS"));
                    tableField.setDefaultValue(resultSet.getString("DATA_DEFAULT"));
                    tableField.setNullable("Y".equalsIgnoreCase(resultSet.getString("NULLABLE")));
                    tableFields.add(tableField);
                }
            }
            if (tableFields.isEmpty()) {
                throw new DataSourcePluginException(
                        "No columns found for dm table " + schemaName + "." + tableName);
            }
        } catch (ClassNotFoundException | SQLException e) {
            throw new DataSourcePluginException("get table fields failed", e);
        }
        return tableFields;
    }

    @Override
    public Map<String, List<TableField>> getTableFields(
            @NonNull String pluginName,
            @NonNull Map<String, String> requestParams,
            @NonNull String database,
            @NonNull List<String> tables) {
        return tables.parallelStream()
                .collect(
                        Collectors.toMap(
                                Function.identity(),
                                tableName ->
                                        getTableFields(
                                                pluginName, requestParams, database, tableName)));
    }

    private Set<String> getPrimaryKeys(
            DatabaseMetaData metaData, String schemaName, String tableName) throws SQLException {
        Set<String> primaryKeys = new HashSet<>();
        ResultSet primaryKeysInfo = metaData.getPrimaryKeys(null, schemaName, tableName);
        while (primaryKeysInfo.next()) {
            String columnName = primaryKeysInfo.getString("COLUMN_NAME");
            if (StringUtils.isNotBlank(columnName)) {
                primaryKeys.add(columnName);
            }
        }
        return primaryKeys;
    }

    private String[] splitTableName(String table) {
        String[] split = table.split("\\.");
        if (split.length != 2) {
            throw new SeaTunnelException(
                    "The tableName for dm must be schemaName.tableName, but tableName is " + table);
        }
        return split;
    }

    private String normalizeIdentifier(String identifier) {
        return identifier == null ? null : identifier.trim().toUpperCase();
    }

    private boolean isNotSystemSchema(String schemaName) {
        return !DMDataSourceConfig.DM_SYSTEM_DATABASES.contains(normalizeIdentifier(schemaName));
    }

    private String buildLikePattern(String value) {
        String normalizedValue = normalizeIdentifier(value);
        if (StringUtils.isBlank(normalizedValue)) {
            return "%";
        }
        return normalizedValue.contains("%") ? normalizedValue : "%" + normalizedValue + "%";
    }

    private Integer parsePositiveInteger(String value) {
        if (StringUtils.isBlank(value)) {
            return null;
        }
        try {
            int parsed = Integer.parseInt(value.trim());
            return parsed > 0 ? parsed : null;
        } catch (NumberFormatException e) {
            log.warn("Invalid dm table query size: {}", value);
            return null;
        }
    }

    private Connection getConnection(Map<String, String> requestParams)
            throws SQLException, ClassNotFoundException {
        String driverClass =
                requestParams.getOrDefault(
                        DMOptionRule.DRIVER.key(), DMOptionRule.DriverType.DM.getDriverClassName());
        try {
            Class.forName(driverClass);
        } catch (ClassNotFoundException e) {
            throw new DataSourcePluginException("DM jdbc driver " + driverClass + " not found", e);
        }
        checkNotNull(requestParams.get(DMOptionRule.URL.key()), "Jdbc url cannot be null");
        String url = JdbcUtils.replaceDatabase(requestParams.get(DMOptionRule.URL.key()), null);
        if (requestParams.containsKey(DMOptionRule.USER.key())) {
            String username = requestParams.get(DMOptionRule.USER.key());
            String password = requestParams.get(DMOptionRule.PASSWORD.key());
            return DriverManager.getConnection(url, username, password);
        }
        return DriverManager.getConnection(url);
    }
}

/*
 * @author: zhjj
 */
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

package org.apache.seatunnel.app.thirdparty.datasource.impl;

import org.apache.seatunnel.shade.com.typesafe.config.Config;
import org.apache.seatunnel.shade.com.typesafe.config.ConfigValueFactory;

import org.apache.seatunnel.app.domain.request.connector.BusinessMode;
import org.apache.seatunnel.app.domain.request.job.DataSourceOption;
import org.apache.seatunnel.app.domain.request.job.SelectTableFields;
import org.apache.seatunnel.app.domain.response.datasource.VirtualTableDetailRes;
import org.apache.seatunnel.app.thirdparty.datasource.DataSourceClientFactory;
import org.apache.seatunnel.app.thirdparty.datasource.DataSourceConfigSwitcher;
import org.apache.seatunnel.common.constants.PluginType;
import org.apache.seatunnel.common.utils.SeaTunnelException;

import org.apache.commons.lang3.StringUtils;

import com.google.auto.service.AutoService;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@AutoService(DataSourceConfigSwitcher.class)
public class DMDataSourceConfigSwitcher extends BaseJdbcDataSourceConfigSwitcher {
    private static final String FIELD_IDE = "field_ide";
    private static final String UPPERCASE = "UPPERCASE";
    private static final String URL = "url";
    private static final String USER = "user";
    private static final String PASSWORD = "password";
    private static final String CURRENT_DATABASE_SQL = "SELECT NAME FROM V$DATABASE";

    public DMDataSourceConfigSwitcher() {}

    @Override
    public Config mergeDatasourceConfig(
            Config dataSourceInstanceConfig,
            VirtualTableDetailRes virtualTableDetail,
            DataSourceOption dataSourceOption,
            SelectTableFields selectTableFields,
            BusinessMode businessMode,
            PluginType pluginType,
            Config connectorConfig) {
        DataSourceOption normalizedOption =
                PluginType.SINK.equals(pluginType)
                        ? normalizeSinkDataSourceOption(dataSourceInstanceConfig, dataSourceOption)
                        : normalizeDataSourceOption(dataSourceOption);
        if (PluginType.SINK.equals(pluginType)) {
            connectorConfig =
                    connectorConfig.withValue(FIELD_IDE, ConfigValueFactory.fromAnyRef(UPPERCASE));
        }
        return super.mergeDatasourceConfig(
                dataSourceInstanceConfig,
                virtualTableDetail,
                normalizedOption,
                selectTableFields,
                businessMode,
                pluginType,
                connectorConfig);
    }

    @Override
    protected String tableFieldsToSql(List<String> tableFields, String database, String fullTable) {
        String[] split = resolveSchemaAndTable(database, fullTable);
        return generateSql(tableFields, database, split[0], split[1]);
    }

    @Override
    protected String generateSql(
            List<String> tableFields, String database, String schema, String table) {
        StringBuilder sb = new StringBuilder();
        sb.append("SELECT ");
        for (int i = 0; i < tableFields.size(); i++) {
            sb.append(quoteIdentifier(tableFields.get(i)));
            if (i < tableFields.size() - 1) {
                sb.append(", ");
            }
        }
        sb.append(" FROM ")
                .append(quoteIdentifier(schema))
                .append(".")
                .append(quoteIdentifier(table));
        return sb.toString();
    }

    @Override
    protected String quoteIdentifier(String identifier) {
        return "\"" + identifier + "\"";
    }

    @Override
    public String getDataSourceName() {
        return "JDBC-DM";
    }

    private DataSourceOption normalizeDataSourceOption(DataSourceOption dataSourceOption) {
        if (dataSourceOption == null
                || dataSourceOption.getTables() == null
                || dataSourceOption.getTables().isEmpty()) {
            return dataSourceOption;
        }

        String database =
                dataSourceOption.getDatabases() == null || dataSourceOption.getDatabases().isEmpty()
                        ? null
                        : dataSourceOption.getDatabases().get(0);
        List<String> normalizedTables = new ArrayList<>(dataSourceOption.getTables().size());
        for (String table : dataSourceOption.getTables()) {
            normalizedTables.add(resolveSchemaAndTable(database, table)[1]);
        }
        return new DataSourceOption(dataSourceOption.getDatabases(), normalizedTables);
    }

    private DataSourceOption normalizeSinkDataSourceOption(
            Config dataSourceInstanceConfig, DataSourceOption dataSourceOption) {
        if (dataSourceOption == null
                || dataSourceOption.getDatabases() == null
                || dataSourceOption.getDatabases().isEmpty()
                || dataSourceOption.getTables() == null
                || dataSourceOption.getTables().isEmpty()) {
            return dataSourceOption;
        }

        String schema = dataSourceOption.getDatabases().get(0);
        String[] schemaAndTable =
                resolveSchemaAndTable(schema, dataSourceOption.getTables().get(0));
        String actualDatabase = resolveCurrentDatabaseName(dataSourceInstanceConfig);
        return new DataSourceOption(
                Collections.singletonList(actualDatabase),
                Collections.singletonList(schemaAndTable[0] + "." + schemaAndTable[1]));
    }

    private String[] resolveSchemaAndTable(String database, String table) {
        String[] split = table.split("\\.", 2);
        if (split.length == 2) {
            return split;
        }
        if (StringUtils.isNotBlank(database)) {
            return new String[] {database, table};
        }
        throw new SeaTunnelException(
                "The tableName for dm must be schemaName.tableName, but tableName is " + table);
    }

    private String resolveCurrentDatabaseName(Config dataSourceInstanceConfig) {
        String fallback =
                dataSourceInstanceConfig.hasPath(URL)
                        ? dataSourceInstanceConfig.getString(URL)
                        : null;
        try (Connection connection =
                        DataSourceClientFactory.getDataSourceClient()
                                .getConnection(
                                        getDataSourceName(),
                                        buildRequestParams(dataSourceInstanceConfig));
                Statement statement = connection.createStatement();
                ResultSet resultSet = statement.executeQuery(CURRENT_DATABASE_SQL)) {
            if (resultSet.next()) {
                String databaseName = resultSet.getString(1);
                if (StringUtils.isNotBlank(databaseName)) {
                    return databaseName.trim();
                }
            }
        } catch (SQLException | RuntimeException e) {
            throw new SeaTunnelException(
                    "Failed to resolve current dm database name from datasource: " + fallback, e);
        }
        throw new SeaTunnelException(
                "Failed to resolve current dm database name from datasource: " + fallback);
    }

    private Map<String, String> buildRequestParams(Config dataSourceInstanceConfig) {
        Map<String, String> requestParams = new HashMap<>();
        dataSourceInstanceConfig
                .entrySet()
                .forEach(
                        entry -> {
                            Object value = entry.getValue().unwrapped();
                            if (value != null) {
                                requestParams.put(entry.getKey(), String.valueOf(value));
                            }
                        });
        if (dataSourceInstanceConfig.hasPath(URL)) {
            requestParams.put(URL, dataSourceInstanceConfig.getString(URL));
        }
        if (dataSourceInstanceConfig.hasPath(USER)) {
            requestParams.put(USER, dataSourceInstanceConfig.getString(USER));
        }
        if (dataSourceInstanceConfig.hasPath(PASSWORD)) {
            requestParams.put(PASSWORD, dataSourceInstanceConfig.getString(PASSWORD));
        }
        return requestParams;
    }
}

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
import org.apache.seatunnel.app.thirdparty.datasource.DataSourceConfigSwitcher;
import org.apache.seatunnel.common.constants.PluginType;
import org.apache.seatunnel.common.utils.SeaTunnelException;

import com.google.auto.service.AutoService;

import java.util.List;

@AutoService(DataSourceConfigSwitcher.class)
public class DMDataSourceConfigSwitcher extends BaseJdbcDataSourceConfigSwitcher {
    private static final String FIELD_IDE = "field_ide";
    private static final String UPPERCASE = "UPPERCASE";

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
        if (PluginType.SINK.equals(pluginType)) {
            connectorConfig =
                    connectorConfig.withValue(FIELD_IDE, ConfigValueFactory.fromAnyRef(UPPERCASE));
        }
        return super.mergeDatasourceConfig(
                dataSourceInstanceConfig,
                virtualTableDetail,
                dataSourceOption,
                selectTableFields,
                businessMode,
                pluginType,
                connectorConfig);
    }

    @Override
    protected String tableFieldsToSql(List<String> tableFields, String database, String fullTable) {
        String[] split = fullTable.split("\\.");
        if (split.length != 2) {
            throw new SeaTunnelException(
                    "The tableName for dm must be schemaName.tableName, but tableName is "
                            + fullTable);
        }

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
}

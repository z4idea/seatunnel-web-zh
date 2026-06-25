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

package org.apache.seatunnel.app.service.impl;

import org.apache.seatunnel.shade.com.fasterxml.jackson.core.type.TypeReference;

import org.apache.seatunnel.app.dal.entity.JobTask;
import org.apache.seatunnel.app.domain.request.job.DataSourceOption;
import org.apache.seatunnel.app.domain.request.job.DatabaseTableSchemaReq;
import org.apache.seatunnel.common.constants.PluginType;
import org.apache.seatunnel.common.utils.JsonUtils;

import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

final class JobDefinitionSourceDatabaseTableFormatter {

    private static final String DEFAULT_DATABASE = "default";

    private JobDefinitionSourceDatabaseTableFormatter() {}

    static String format(List<JobTask> tasks) {
        if (CollectionUtils.isEmpty(tasks)) {
            return null;
        }

        Set<String> databaseTables = new LinkedHashSet<>();
        for (JobTask task : tasks) {
            if (!StringUtils.equalsIgnoreCase(task.getType(), PluginType.SOURCE.name())) {
                continue;
            }

            List<String> outputSchemaTables = extractFromOutputSchema(task);
            if (CollectionUtils.isNotEmpty(outputSchemaTables)) {
                databaseTables.addAll(outputSchemaTables);
                continue;
            }

            databaseTables.addAll(extractFromDataSourceOption(task));
        }

        return databaseTables.isEmpty() ? null : String.join(", ", databaseTables);
    }

    private static List<String> extractFromOutputSchema(JobTask task) {
        if (StringUtils.isBlank(task.getOutputSchema())) {
            return Collections.emptyList();
        }

        try {
            List<DatabaseTableSchemaReq> outputSchema =
                    JsonUtils.parseObject(
                            task.getOutputSchema(),
                            new TypeReference<List<DatabaseTableSchemaReq>>() {});
            if (CollectionUtils.isEmpty(outputSchema)) {
                return Collections.emptyList();
            }
            return outputSchema.stream()
                    .map(schema -> formatDatabaseTable(schema.getDatabase(), schema.getTableName()))
                    .filter(StringUtils::isNotBlank)
                    .collect(Collectors.toList());
        } catch (Exception ignored) {
            return Collections.emptyList();
        }
    }

    private static List<String> extractFromDataSourceOption(JobTask task) {
        if (StringUtils.isBlank(task.getDataSourceOption())) {
            return Collections.emptyList();
        }

        try {
            DataSourceOption dataSourceOption =
                    JsonUtils.parseObject(task.getDataSourceOption(), DataSourceOption.class);
            if (dataSourceOption == null || CollectionUtils.isEmpty(dataSourceOption.getTables())) {
                return Collections.emptyList();
            }

            List<String> tables = dataSourceOption.getTables();
            List<String> databases =
                    dataSourceOption.getDatabases() == null
                            ? Collections.emptyList()
                            : dataSourceOption.getDatabases();
            List<String> databaseTables = new ArrayList<>();

            if (CollectionUtils.isEmpty(databases)) {
                tables.forEach(table -> databaseTables.add(formatDatabaseTable(null, table)));
                return databaseTables;
            }

            if (databases.size() == 1 || databases.size() != tables.size()) {
                String database = databases.get(0);
                tables.forEach(table -> databaseTables.add(formatDatabaseTable(database, table)));
                return databaseTables;
            }

            for (int index = 0; index < tables.size(); index++) {
                databaseTables.add(formatDatabaseTable(databases.get(index), tables.get(index)));
            }
            return databaseTables;
        } catch (Exception ignored) {
            return Collections.emptyList();
        }
    }

    private static String formatDatabaseTable(String database, String tableName) {
        if (StringUtils.isBlank(tableName)) {
            return null;
        }

        String normalizedTableName = tableName.trim();
        if (StringUtils.isBlank(database)
                || StringUtils.equalsIgnoreCase(database.trim(), DEFAULT_DATABASE)) {
            return normalizedTableName;
        }
        return database.trim() + "-" + normalizedTableName;
    }
}

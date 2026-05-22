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

package org.apache.seatunnel.datasource.plugin.localfile;

import org.apache.seatunnel.api.configuration.util.OptionRule;
import org.apache.seatunnel.datasource.plugin.api.DataSourceChannel;
import org.apache.seatunnel.datasource.plugin.api.model.TableField;

import org.apache.commons.lang3.StringUtils;

import lombok.NonNull;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class LocalFileDatasourceChannel implements DataSourceChannel {

    @Override
    public OptionRule getDataSourceOptions(@NonNull String pluginName) {
        return LocalFileOptionRule.optionRule();
    }

    @Override
    public OptionRule getDatasourceMetadataFieldsByDataSourceName(@NonNull String pluginName) {
        return LocalFileOptionRule.metadataRule();
    }

    @Override
    public List<String> getTables(
            @NonNull String pluginName,
            Map<String, String> requestParams,
            String database,
            Map<String, String> options) {
        String path = requestParams.get(LocalFileOptionRule.PATH.key());
        String tableName = LocalFileSchemaUtils.tableNameFromPath(path);
        String filterName = options == null ? "" : options.get("filterName");
        List<String> tables = new ArrayList<>();
        if (StringUtils.isBlank(filterName) || tableName.contains(filterName)) {
            tables.add(tableName);
        }
        return tables;
    }

    @Override
    public List<String> getDatabases(
            @NonNull String pluginName, @NonNull Map<String, String> requestParams) {
        return DEFAULT_DATABASES;
    }

    @Override
    public boolean checkDataSourceConnectivity(
            @NonNull String pluginName, @NonNull Map<String, String> requestParams) {
        String path = requestParams.get(LocalFileOptionRule.PATH.key());
        String fileFormatType = requestParams.get(LocalFileOptionRule.FILE_FORMAT_TYPE.key());
        LocalFileSchemaUtils.validateReadableSupportedFile(
                new File(path), LocalFileSchemaUtils.normalizeFormat(fileFormatType, path));
        return true;
    }

    @Override
    public boolean canAbleGetSchema() {
        return true;
    }

    @Override
    public List<TableField> getTableFields(
            @NonNull String pluginName,
            @NonNull Map<String, String> requestParams,
            @NonNull String database,
            @NonNull String table) {
        String path = requestParams.get(LocalFileOptionRule.PATH.key());
        String fileFormatType = requestParams.get(LocalFileOptionRule.FILE_FORMAT_TYPE.key());
        String encoding = requestParams.get(LocalFileOptionRule.ENCODING.key());
        boolean csvUseHeaderLine =
                Boolean.parseBoolean(
                        StringUtils.defaultIfBlank(
                                requestParams.get(LocalFileOptionRule.CSV_USE_HEADER_LINE.key()),
                                "true"));
        int skipHeaderRowNumber =
                Integer.parseInt(
                        StringUtils.defaultIfBlank(
                                requestParams.get(LocalFileOptionRule.SKIP_HEADER_ROW_NUMBER.key()),
                                "0"));
        return LocalFileSchemaUtils.inferFields(
                path, fileFormatType, encoding, csvUseHeaderLine, skipHeaderRowNumber);
    }
}

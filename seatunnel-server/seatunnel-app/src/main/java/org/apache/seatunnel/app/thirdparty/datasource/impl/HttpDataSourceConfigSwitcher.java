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

import org.apache.seatunnel.api.configuration.Option;
import org.apache.seatunnel.api.configuration.util.OptionRule;
import org.apache.seatunnel.api.configuration.util.RequiredOption;
import org.apache.seatunnel.app.domain.request.connector.BusinessMode;
import org.apache.seatunnel.app.domain.request.job.DataSourceOption;
import org.apache.seatunnel.app.domain.request.job.SelectTableFields;
import org.apache.seatunnel.app.domain.response.datasource.VirtualTableDetailRes;
import org.apache.seatunnel.app.dynamicforms.FormStructure;
import org.apache.seatunnel.app.thirdparty.datasource.AbstractDataSourceConfigSwitcher;
import org.apache.seatunnel.app.thirdparty.datasource.DataSourceConfigSwitcher;
import org.apache.seatunnel.common.constants.PluginType;
import org.apache.seatunnel.datasource.plugin.http.HttpOptionRule;

import org.apache.commons.lang3.StringUtils;

import com.google.auto.service.AutoService;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@AutoService(DataSourceConfigSwitcher.class)
public class HttpDataSourceConfigSwitcher extends AbstractDataSourceConfigSwitcher {

    private static final String KEY_FORMAT = "format";
    private static final String KEY_METHOD = "method";
    private static final String KEY_HEADERS = "headers";
    private static final String KEY_BODY = "body";
    private static final String KEY_CONTENT_TYPE = "content_type";
    private static final String KEY_GET = "GET";
    private static final String KEY_POST = "POST";
    private static final String VALUE_JSON = "json";

    @Override
    public String getDataSourceName() {
        return HttpOptionRule.PLUGIN_NAME;
    }

    @Override
    public FormStructure filterOptionRule(
            String connectorName,
            OptionRule dataSourceOptionRule,
            OptionRule virtualTableOptionRule,
            BusinessMode businessMode,
            PluginType pluginType,
            OptionRule connectorOptionRule,
            List<RequiredOption> addRequiredOptions,
            List<Option<?>> addOptionalOptions,
            List<String> excludedKeys) {
        excludedKeys.addAll(buildDatasourceKeys());
        excludedKeys.add(KEY_FORMAT);

        return super.filterOptionRule(
                connectorName,
                dataSourceOptionRule,
                virtualTableOptionRule,
                businessMode,
                pluginType,
                connectorOptionRule,
                addRequiredOptions,
                addOptionalOptions,
                excludedKeys);
    }

    @Override
    public Config mergeDatasourceConfig(
            Config dataSourceInstanceConfig,
            VirtualTableDetailRes virtualTableDetail,
            DataSourceOption dataSourceOption,
            SelectTableFields selectTableFields,
            BusinessMode businessMode,
            PluginType pluginType,
            Config connectorConfig) {
        Config mergedConfig =
                super.mergeDatasourceConfig(
                        dataSourceInstanceConfig,
                        virtualTableDetail,
                        dataSourceOption,
                        selectTableFields,
                        businessMode,
                        pluginType,
                        connectorConfig);

        if (!PluginType.SOURCE.equals(pluginType)) {
            return mergedConfig;
        }

        String method =
                mergedConfig.hasPath(KEY_METHOD)
                        ? StringUtils.upperCase(mergedConfig.getString(KEY_METHOD).trim())
                        : KEY_GET;
        mergedConfig =
                mergedConfig
                        .withValue(KEY_FORMAT, ConfigValueFactory.fromAnyRef(VALUE_JSON))
                        .withValue(KEY_METHOD, ConfigValueFactory.fromAnyRef(method));

        if (KEY_GET.equals(method) && hasNonBlankPath(mergedConfig, KEY_BODY)) {
            throw new IllegalStateException("HTTP source GET request must not contain a body");
        }

        if (mergedConfig.hasPath(KEY_CONTENT_TYPE)) {
            String contentType = StringUtils.trimToNull(mergedConfig.getString(KEY_CONTENT_TYPE));
            if (contentType != null && !hasHeaderIgnoreCase(mergedConfig, "Content-Type")) {
                mergedConfig =
                        mergedConfig.withValue(
                                KEY_HEADERS + ".Content-Type",
                                ConfigValueFactory.fromAnyRef(contentType));
            }
            mergedConfig = mergedConfig.withoutPath(KEY_CONTENT_TYPE);
        }

        if (KEY_GET.equals(method) && hasBlankPath(mergedConfig, KEY_BODY)) {
            mergedConfig = mergedConfig.withoutPath(KEY_BODY);
        }

        if (KEY_POST.equals(method)
                && hasNonBlankPath(mergedConfig, KEY_BODY)
                && !hasHeaderIgnoreCase(mergedConfig, "Content-Type")) {
            mergedConfig =
                    mergedConfig.withValue(
                            KEY_HEADERS + ".Content-Type",
                            ConfigValueFactory.fromAnyRef(HttpOptionRule.DEFAULT_CONTENT_TYPE));
        }

        for (String datasourceKey : buildDatasourceKeys()) {
            if (KEY_CONTENT_TYPE.equals(datasourceKey)) {
                continue;
            }
            if (mergedConfig.hasPath(datasourceKey)
                    && connectorConfig.hasPath(datasourceKey)
                    && !dataSourceInstanceConfig.hasPath(datasourceKey)) {
                mergedConfig = mergedConfig.withoutPath(datasourceKey);
            }
        }

        return mergedConfig;
    }

    private boolean hasHeaderIgnoreCase(Config config, String headerName) {
        if (!config.hasPath(KEY_HEADERS)) {
            return false;
        }
        return config.getConfig(KEY_HEADERS).entrySet().stream()
                .map(Map.Entry::getKey)
                .anyMatch(key -> headerName.equalsIgnoreCase(key));
    }

    private boolean hasNonBlankPath(Config config, String path) {
        return config.hasPath(path) && StringUtils.isNotBlank(config.getString(path));
    }

    private boolean hasBlankPath(Config config, String path) {
        return config.hasPath(path) && StringUtils.isBlank(config.getString(path));
    }

    private List<String> buildDatasourceKeys() {
        List<String> keys = new ArrayList<>();
        keys.add(HttpOptionRule.URL.key());
        keys.add(HttpOptionRule.METHOD.key());
        keys.add(HttpOptionRule.HEADERS.key());
        keys.add(HttpOptionRule.PARAMS.key());
        keys.add(HttpOptionRule.BODY.key());
        keys.add(HttpOptionRule.CONTENT_TYPE.key());
        keys.add(HttpOptionRule.RETRY.key());
        keys.add(HttpOptionRule.RETRY_BACKOFF_MULTIPLIER_MS.key());
        keys.add(HttpOptionRule.RETRY_BACKOFF_MAX_MS.key());
        return keys;
    }
}

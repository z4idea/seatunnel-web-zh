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
import org.apache.seatunnel.shade.com.typesafe.config.ConfigFactory;

import org.apache.seatunnel.api.configuration.Option;
import org.apache.seatunnel.api.configuration.Options;
import org.apache.seatunnel.api.configuration.util.OptionRule;
import org.apache.seatunnel.app.domain.request.connector.BusinessMode;
import org.apache.seatunnel.app.domain.request.job.DataSourceOption;
import org.apache.seatunnel.app.domain.request.job.SelectTableFields;
import org.apache.seatunnel.app.dynamicforms.AbstractFormOption;
import org.apache.seatunnel.app.dynamicforms.FormStructure;
import org.apache.seatunnel.common.constants.PluginType;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class BaseJdbcDataSourceConfigSwitcherTests {

    @Test
    void shouldExposeIncrementalFieldsForJdbcSourceForm() {
        MysqlDatasourceConfigSwitcher switcher = new MysqlDatasourceConfigSwitcher();
        Option<String> usernameOption =
                Options.key("username").stringType().noDefaultValue().withDescription("username");
        Option<String> passwordOption =
                Options.key("password").stringType().noDefaultValue().withDescription("password");

        FormStructure formStructure =
                switcher.filterOptionRule(
                        "Jdbc",
                        OptionRule.builder().build(),
                        OptionRule.builder().build(),
                        BusinessMode.DATA_INTEGRATION,
                        PluginType.SOURCE,
                        OptionRule.builder().optional(usernameOption, passwordOption).build(),
                        new ArrayList<>(),
                        new ArrayList<>(),
                        new ArrayList<>());

        Map<String, AbstractFormOption> formsByField =
                formStructure.getForms().stream()
                        .collect(Collectors.toMap(AbstractFormOption::getField, form -> form));
        List<String> formFields =
                formStructure.getForms().stream()
                        .map(AbstractFormOption::getField)
                        .collect(Collectors.toList());

        Assertions.assertEquals(
                "FULL", String.valueOf(formsByField.get("extract_mode").getDefaultValue()));
        Assertions.assertEquals("extract_mode", formFields.get(0));
        Assertions.assertTrue(formFields.indexOf("extract_mode") < formFields.indexOf("username"));
        Assertions.assertEquals(
                "extract_mode", formsByField.get("incremental_column").getShow().get("field"));
        Assertions.assertTrue(
                formsByField
                        .get("incremental_column")
                        .getShow()
                        .get("value")
                        .toString()
                        .contains("INCREMENTAL"));
        Assertions.assertEquals(
                "extract_mode", formsByField.get("incremental_column_type").getShow().get("field"));
        Assertions.assertTrue(
                formsByField
                        .get("incremental_column_type")
                        .getShow()
                        .get("value")
                        .toString()
                        .contains("INCREMENTAL"));
    }

    @Test
    void shouldRemoveIncrementalUiFieldsBeforeMergingJdbcSourceConfig() {
        MysqlDatasourceConfigSwitcher switcher = new MysqlDatasourceConfigSwitcher();
        Config datasourceConfig =
                ConfigFactory.parseString(
                        "url = \"jdbc:mysql://localhost:3306/default_db\"\n"
                                + "user = \"root\"\n"
                                + "password = \"secret\"");
        Config connectorConfig =
                ConfigFactory.parseString(
                        "extract_mode = \"INCREMENTAL\"\n"
                                + "incremental_column = \"id\"\n"
                                + "incremental_column_type = \"NUMBER\"\n"
                                + "partition_num = 2");

        Config mergedConfig =
                switcher.mergeDatasourceConfig(
                        datasourceConfig,
                        null,
                        new DataSourceOption(Arrays.asList("test_db"), Arrays.asList("orders")),
                        SelectTableFields.builder()
                                .tableFields(Arrays.asList("id", "name"))
                                .build(),
                        BusinessMode.DATA_INTEGRATION,
                        PluginType.SOURCE,
                        connectorConfig);

        Assertions.assertFalse(mergedConfig.hasPath("extract_mode"));
        Assertions.assertFalse(mergedConfig.hasPath("incremental_column"));
        Assertions.assertFalse(mergedConfig.hasPath("incremental_column_type"));
        Assertions.assertEquals(2, mergedConfig.getInt("partition_num"));
        Assertions.assertEquals(
                "SELECT `id`, `name` FROM `test_db`.`orders`", mergedConfig.getString("query"));
    }
}

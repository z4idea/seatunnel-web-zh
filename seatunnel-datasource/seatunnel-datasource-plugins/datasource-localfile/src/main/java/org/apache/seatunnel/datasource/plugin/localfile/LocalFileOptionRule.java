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

import org.apache.seatunnel.api.configuration.Option;
import org.apache.seatunnel.api.configuration.Options;
import org.apache.seatunnel.api.configuration.util.OptionRule;

import java.util.Map;

public class LocalFileOptionRule {

    public static final String PLUGIN_NAME = "LocalFile";
    public static final String DEFAULT_DATABASE = "default";
    public static final String DEFAULT_ENCODING = "UTF-8";
    public static final String CSV_FORMAT = "csv";
    public static final String JSON_FORMAT = "json";

    public static final Option<String> PATH =
            Options.key("path").stringType().noDefaultValue().withDescription("Local file path");

    public static final Option<String> FILE_FORMAT_TYPE =
            Options.key("file_format_type")
                    .stringType()
                    .noDefaultValue()
                    .withDescription("Local file format type: csv or json");

    public static final Option<String> ENCODING =
            Options.key("encoding")
                    .stringType()
                    .defaultValue(DEFAULT_ENCODING)
                    .withDescription("Local file encoding");

    public static final Option<Boolean> CSV_USE_HEADER_LINE =
            Options.key("csv_use_header_line")
                    .booleanType()
                    .defaultValue(true)
                    .withDescription("Whether the first CSV line is header");

    public static final Option<Integer> SKIP_HEADER_ROW_NUMBER =
            Options.key("skip_header_row_number")
                    .intType()
                    .defaultValue(0)
                    .withDescription("CSV header rows to skip before parsing data");

    public static final Option<Map<String, String>> SCHEMA =
            Options.key("schema").mapType().noDefaultValue().withDescription("SeaTunnel schema");

    public static OptionRule optionRule() {
        return OptionRule.builder().required(PATH, FILE_FORMAT_TYPE).optional(ENCODING).build();
    }

    public static OptionRule metadataRule() {
        return OptionRule.builder()
                .optional(CSV_USE_HEADER_LINE, SKIP_HEADER_ROW_NUMBER, SCHEMA)
                .build();
    }

    private LocalFileOptionRule() {}
}

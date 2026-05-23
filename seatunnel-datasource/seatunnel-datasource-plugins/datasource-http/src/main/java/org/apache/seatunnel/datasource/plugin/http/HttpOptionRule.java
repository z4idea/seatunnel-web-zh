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

package org.apache.seatunnel.datasource.plugin.http;

import org.apache.seatunnel.api.configuration.Option;
import org.apache.seatunnel.api.configuration.Options;
import org.apache.seatunnel.api.configuration.util.OptionRule;

import java.util.Map;

public final class HttpOptionRule {

    public static final String PLUGIN_NAME = "Http";
    public static final String DEFAULT_DATABASE = "default";
    public static final String DEFAULT_METHOD = "GET";
    public static final String DEFAULT_CONTENT_TYPE = "application/json";

    public static final Option<String> URL =
            Options.key("url").stringType().noDefaultValue().withDescription("HTTP request url");

    public static final Option<HttpDatasourceMethod> METHOD =
            Options.key("method")
                    .enumType(HttpDatasourceMethod.class)
                    .defaultValue(HttpDatasourceMethod.GET)
                    .withDescription("HTTP request method, only supports GET and POST");

    public static final Option<Map<String, String>> HEADERS =
            Options.key("headers")
                    .mapType()
                    .noDefaultValue()
                    .withDescription("HTTP request headers");

    public static final Option<Map<String, String>> PARAMS =
            Options.key("params").mapType().noDefaultValue().withDescription("HTTP request params");

    public static final Option<String> BODY =
            Options.key("body").stringType().noDefaultValue().withDescription("HTTP request body");

    public static final Option<String> CONTENT_TYPE =
            Options.key("content_type")
                    .stringType()
                    .noDefaultValue()
                    .withDescription("Optional Content-Type header override");

    public static final Option<Integer> RETRY =
            Options.key("retry")
                    .intType()
                    .noDefaultValue()
                    .withDescription("Max retry times when the request fails");

    public static final Option<Integer> RETRY_BACKOFF_MULTIPLIER_MS =
            Options.key("retry_backoff_multiplier_ms")
                    .intType()
                    .defaultValue(100)
                    .withDescription("Retry backoff multiplier in milliseconds");

    public static final Option<Integer> RETRY_BACKOFF_MAX_MS =
            Options.key("retry_backoff_max_ms")
                    .intType()
                    .defaultValue(10000)
                    .withDescription("Retry backoff max time in milliseconds");

    public static OptionRule optionRule() {
        return OptionRule.builder()
                .required(URL)
                .optional(
                        METHOD,
                        HEADERS,
                        PARAMS,
                        BODY,
                        CONTENT_TYPE,
                        RETRY,
                        RETRY_BACKOFF_MULTIPLIER_MS,
                        RETRY_BACKOFF_MAX_MS)
                .build();
    }

    public static OptionRule metadataRule() {
        return OptionRule.builder().build();
    }

    private HttpOptionRule() {}
}

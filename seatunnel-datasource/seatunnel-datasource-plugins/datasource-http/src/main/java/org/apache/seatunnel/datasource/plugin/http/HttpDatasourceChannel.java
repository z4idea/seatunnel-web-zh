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

import org.apache.seatunnel.shade.com.fasterxml.jackson.databind.JsonNode;
import org.apache.seatunnel.shade.com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.seatunnel.shade.com.typesafe.config.Config;
import org.apache.seatunnel.shade.com.typesafe.config.ConfigFactory;

import org.apache.seatunnel.api.configuration.util.OptionRule;
import org.apache.seatunnel.datasource.plugin.api.DataSourceChannel;
import org.apache.seatunnel.datasource.plugin.api.DataSourcePluginException;
import org.apache.seatunnel.datasource.plugin.api.model.TableField;

import org.apache.commons.lang3.StringUtils;

import lombok.NonNull;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class HttpDatasourceChannel implements DataSourceChannel {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final int CONNECT_TIMEOUT_MS = 5000;
    private static final int READ_TIMEOUT_MS = 10000;
    private static final int MAX_RESPONSE_BYTES = 1024 * 1024;

    @Override
    public OptionRule getDataSourceOptions(@NonNull String pluginName) {
        return HttpOptionRule.optionRule();
    }

    @Override
    public OptionRule getDatasourceMetadataFieldsByDataSourceName(@NonNull String pluginName) {
        return HttpOptionRule.metadataRule();
    }

    @Override
    public List<String> getTables(
            @NonNull String pluginName,
            Map<String, String> requestParams,
            String database,
            Map<String, String> options) {
        String filterName =
                options == null ? "" : StringUtils.defaultString(options.get("filterName"));
        String tableName =
                options == null
                        ? "http_source"
                        : StringUtils.defaultIfBlank(
                                options.get("logicalTableName"), "http_source");
        if (StringUtils.isBlank(filterName) || tableName.contains(filterName)) {
            return Collections.singletonList(tableName);
        }
        return Collections.emptyList();
    }

    @Override
    public List<String> getDatabases(
            @NonNull String pluginName, @NonNull Map<String, String> requestParams) {
        return DEFAULT_DATABASES;
    }

    @Override
    public boolean checkDataSourceConnectivity(
            @NonNull String pluginName, @NonNull Map<String, String> requestParams) {
        try {
            RequestContext context = buildRequestContext(requestParams);
            byte[] response = execute(context);
            parseJson(response);
            return true;
        } catch (Exception ex) {
            throw new DataSourcePluginException(
                    "HTTP datasource connectivity check failed: " + ex.getMessage(), ex);
        }
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
        return new ArrayList<>();
    }

    private RequestContext buildRequestContext(Map<String, String> requestParams) {
        String rawUrl = requireText(requestParams, HttpOptionRule.URL.key(), "url");
        String method =
                StringUtils.defaultIfBlank(
                                requestParams.get(HttpOptionRule.METHOD.key()),
                                HttpOptionRule.DEFAULT_METHOD)
                        .trim()
                        .toUpperCase();
        if (!"GET".equals(method) && !"POST".equals(method)) {
            throw new IllegalArgumentException("Only GET and POST methods are supported");
        }

        String body = StringUtils.trimToEmpty(requestParams.get(HttpOptionRule.BODY.key()));
        if ("GET".equals(method) && StringUtils.isNotBlank(body)) {
            throw new IllegalArgumentException("GET request must not contain a body");
        }

        Map<String, String> headers =
                parseMapConfig(requestParams.get(HttpOptionRule.HEADERS.key()));
        Map<String, String> params = parseMapConfig(requestParams.get(HttpOptionRule.PARAMS.key()));
        String contentType =
                StringUtils.trimToNull(requestParams.get(HttpOptionRule.CONTENT_TYPE.key()));
        if (StringUtils.isNotBlank(contentType)
                && headers.keySet().stream()
                        .noneMatch(key -> "content-type".equalsIgnoreCase(key))) {
            headers.put("Content-Type", contentType);
        }
        if ("POST".equals(method)
                && StringUtils.isNotBlank(body)
                && headers.keySet().stream()
                        .noneMatch(key -> "content-type".equalsIgnoreCase(key))) {
            headers.put("Content-Type", HttpOptionRule.DEFAULT_CONTENT_TYPE);
        }

        String finalUrl = appendQuery(rawUrl, params);
        return new RequestContext(method, finalUrl, headers, body);
    }

    private byte[] execute(RequestContext context) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(context.url).openConnection();
        connection.setRequestMethod(context.method);
        connection.setInstanceFollowRedirects(true);
        connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(READ_TIMEOUT_MS);
        context.headers.forEach(connection::setRequestProperty);

        if ("POST".equals(context.method) && StringUtils.isNotBlank(context.body)) {
            connection.setDoOutput(true);
            byte[] payload = context.body.getBytes(StandardCharsets.UTF_8);
            try (OutputStream outputStream = connection.getOutputStream()) {
                outputStream.write(payload);
            }
        }

        int status = connection.getResponseCode();
        byte[] response =
                readStream(
                        status >= 200 && status < 300
                                ? connection.getInputStream()
                                : connection.getErrorStream());
        if (status < 200 || status >= 300) {
            throw new IllegalStateException(
                    "HTTP status " + status + " returned from " + context.url);
        }
        return response;
    }

    private JsonNode parseJson(byte[] responseBody) throws Exception {
        try {
            return OBJECT_MAPPER.readTree(responseBody);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Response body is not valid JSON", ex);
        }
    }

    private byte[] readStream(InputStream inputStream) throws Exception {
        if (inputStream == null) {
            return new byte[0];
        }
        try (InputStream stream = inputStream;
                ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int read;
            while ((read = stream.read(buffer)) != -1) {
                outputStream.write(buffer, 0, read);
                if (outputStream.size() > MAX_RESPONSE_BYTES) {
                    throw new IllegalStateException("Response body exceeds 1MB limit");
                }
            }
            return outputStream.toByteArray();
        }
    }

    private Map<String, String> parseMapConfig(String rawValue) {
        if (StringUtils.isBlank(rawValue)) {
            return new LinkedHashMap<>();
        }
        String trimmed = rawValue.trim();
        try {
            Config config =
                    trimmed.startsWith("{")
                            ? ConfigFactory.parseString("root = " + trimmed).getConfig("root")
                            : ConfigFactory.parseString(trimmed);
            return config.entrySet().stream()
                    .collect(
                            Collectors.toMap(
                                    Map.Entry::getKey,
                                    entry -> String.valueOf(entry.getValue().unwrapped()),
                                    (left, right) -> right,
                                    LinkedHashMap::new));
        } catch (RuntimeException ex) {
            throw new IllegalArgumentException("Invalid map config: " + ex.getMessage(), ex);
        }
    }

    private String appendQuery(String rawUrl, Map<String, String> params) {
        if (params.isEmpty()) {
            return rawUrl;
        }
        String query =
                params.entrySet().stream()
                        .map(
                                entry ->
                                        encode(entry.getKey())
                                                + "="
                                                + encode(
                                                        StringUtils.defaultString(
                                                                entry.getValue())))
                        .collect(Collectors.joining("&"));
        URI uri = URI.create(rawUrl);
        String separator = StringUtils.isBlank(uri.getQuery()) ? "?" : "&";
        return rawUrl + separator + query;
    }

    private String encode(String value) {
        try {
            return URLEncoder.encode(value, StandardCharsets.UTF_8.name());
        } catch (Exception ex) {
            throw new IllegalStateException("Encode http parameter failed", ex);
        }
    }

    private String requireText(Map<String, String> requestParams, String key, String label) {
        String value = requestParams.get(key);
        if (StringUtils.isBlank(value)) {
            throw new IllegalArgumentException(label + " must not be empty");
        }
        return value.trim();
    }

    private static final class RequestContext {
        private final String method;
        private final String url;
        private final Map<String, String> headers;
        private final String body;

        private RequestContext(
                String method, String url, Map<String, String> headers, String body) {
            this.method = method;
            this.url = url;
            this.headers = headers;
            this.body = body;
        }
    }
}

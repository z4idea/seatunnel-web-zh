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

import org.apache.seatunnel.shade.com.fasterxml.jackson.databind.JsonNode;
import org.apache.seatunnel.shade.com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.seatunnel.shade.com.typesafe.config.Config;
import org.apache.seatunnel.shade.com.typesafe.config.ConfigFactory;

import org.apache.seatunnel.app.domain.request.http.HttpDatasourcePreviewFieldReq;
import org.apache.seatunnel.app.domain.request.http.HttpDatasourcePreviewReq;
import org.apache.seatunnel.app.domain.response.http.HttpDatasourcePreviewRes;
import org.apache.seatunnel.app.service.IHttpDatasourceService;
import org.apache.seatunnel.datasource.plugin.api.model.TableField;
import org.apache.seatunnel.datasource.plugin.http.HttpOptionRule;
import org.apache.seatunnel.server.common.SeatunnelErrorEnum;
import org.apache.seatunnel.server.common.SeatunnelException;

import org.apache.commons.lang3.StringUtils;

import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class HttpDatasourceServiceImpl implements IHttpDatasourceService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 200;
    private static final int MAX_RESPONSE_BYTES = 1024 * 1024;
    private static final int PREVIEW_CONNECT_TIMEOUT_MS = 5000;
    private static final int PREVIEW_READ_TIMEOUT_MS = 10000;
    private static final String KEY_KEEP_PARAMS_AS_FORM = "keep_params_as_form";
    private static final String KEY_KEEP_PAGE_PARAM_AS_HTTP_PARAM = "keep_page_param_as_http_param";
    private static final String KEY_USE_PLACEHOLDER_REPLACEMENT = "use_placeholder_replacement";
    private static final String KEY_CONTENT_FIELD = "content_field";
    private static final String KEY_JSON_FIELD = "json_field";
    private static final String KEY_PAGEING = "pageing";
    private static final String KEY_START_PAGE_NUMBER = "start_page_number";
    private static final String KEY_PAGE_FIELD = "page_field";
    private static final String KEY_JSON_FIELD_MISSED_RETURN_NULL = "json_filed_missed_return_null";
    private static final String KEY_METHOD = "method";
    private static final String KEY_BODY = "body";
    private static final String KEY_HEADERS = "headers";
    private static final String KEY_PARAMS = "params";
    private static final String KEY_CONTENT_TYPE = "content_type";
    private static final String KEY_GET = "GET";
    private static final String KEY_POST = "POST";
    private static final Pattern NON_WORD_PATTERN = Pattern.compile("[^A-Za-z0-9_]+");

    @Override
    public HttpDatasourcePreviewRes preview(HttpDatasourcePreviewReq req) {
        Map<String, String> datasourceConfig =
                req.getDatasourceConfig() == null
                        ? new LinkedHashMap<>()
                        : new LinkedHashMap<>(req.getDatasourceConfig());
        Map<String, Object> connectorConfig =
                req.getConnectorConfig() == null
                        ? Collections.emptyMap()
                        : req.getConnectorConfig();
        int limit = Math.min(Math.max(defaultInt(req.getLimit(), DEFAULT_LIMIT), 1), MAX_LIMIT);
        List<String> warnings = new ArrayList<>();

        try {
            RequestContext requestContext = buildRequestContext(datasourceConfig, connectorConfig);
            JsonNode responseJson = executeRequest(requestContext);
            List<JsonNode> contentNodes =
                    resolveContentNodes(
                            responseJson,
                            getConfigString(connectorConfig, KEY_CONTENT_FIELD),
                            warnings);
            PreviewRowsResult previewRowsResult =
                    buildPreviewRows(
                            contentNodes,
                            parseMapConfig(connectorConfig.get(KEY_JSON_FIELD)),
                            getConfigBoolean(connectorConfig, KEY_JSON_FIELD_MISSED_RETURN_NULL),
                            warnings,
                            limit);
            List<Map<String, Object>> previewRows = previewRowsResult.rows;
            List<TableField> fields =
                    buildPreviewFields(
                            previewRows,
                            req.getSchemaFields(),
                            parseMapConfig(connectorConfig.get(KEY_JSON_FIELD)),
                            previewRowsResult.fieldPathMap,
                            warnings);

            List<Map<String, Object>> projectedRows =
                    projectRows(previewRows, fields, warnings, limit);
            if (fields.isEmpty()) {
                warnings.add("No schema fields were inferred from the HTTP response");
            }
            if (projectedRows.isEmpty()) {
                warnings.add("No preview rows were read from the HTTP response");
            }
            return HttpDatasourcePreviewRes.builder()
                    .fields(fields)
                    .rows(projectedRows)
                    .warnings(deduplicateWarnings(warnings))
                    .build();
        } catch (SeatunnelException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new SeatunnelException(
                    SeatunnelErrorEnum.ILLEGAL_STATE,
                    "Preview http datasource failed: " + ex.getMessage());
        }
    }

    private RequestContext buildRequestContext(
            Map<String, String> datasourceConfig, Map<String, Object> connectorConfig) {
        String rawUrl = requireText(datasourceConfig, HttpOptionRule.URL.key(), "url");
        String method =
                StringUtils.defaultIfBlank(
                                datasourceConfig.get(HttpOptionRule.METHOD.key()),
                                HttpOptionRule.DEFAULT_METHOD)
                        .trim()
                        .toUpperCase();
        if (!KEY_GET.equals(method) && !KEY_POST.equals(method)) {
            throw new IllegalArgumentException("Only GET and POST methods are supported");
        }

        Map<String, String> headers = parseMapConfig(datasourceConfig.get(KEY_HEADERS));
        Map<String, String> params = parseMapConfig(datasourceConfig.get(KEY_PARAMS));
        Map<String, String> pagingParams = parseMapConfig(connectorConfig.get(KEY_PAGEING));
        applyPagingDefaults(pagingParams, connectorConfig);
        params.replaceAll(
                (key, value) ->
                        replacePlaceholders(
                                value,
                                pagingParams,
                                getConfigBoolean(
                                        connectorConfig, KEY_USE_PLACEHOLDER_REPLACEMENT)));

        String body = StringUtils.trimToEmpty(datasourceConfig.get(KEY_BODY));
        body =
                replacePlaceholders(
                        body,
                        pagingParams,
                        getConfigBoolean(connectorConfig, KEY_USE_PLACEHOLDER_REPLACEMENT));
        if (KEY_GET.equals(method) && StringUtils.isNotBlank(body)) {
            throw new IllegalArgumentException("GET request must not contain a body");
        }

        String contentType = StringUtils.trimToNull(datasourceConfig.get(KEY_CONTENT_TYPE));
        if (contentType != null && !containsHeader(headers, "Content-Type")) {
            headers.put("Content-Type", contentType);
        }

        boolean keepParamsAsForm = getConfigBoolean(connectorConfig, KEY_KEEP_PARAMS_AS_FORM);
        boolean keepPageParamAsHttpParam =
                getConfigBoolean(connectorConfig, KEY_KEEP_PAGE_PARAM_AS_HTTP_PARAM);
        if (keepPageParamAsHttpParam && !pagingParams.isEmpty()) {
            params.putAll(pagingParams);
        }

        String requestBody = body;
        String finalUrl = rawUrl;
        if (KEY_POST.equals(method)
                && keepParamsAsForm
                && StringUtils.isBlank(body)
                && !params.isEmpty()) {
            requestBody = buildFormBody(params);
            if (!containsHeader(headers, "Content-Type")) {
                headers.put("Content-Type", "application/x-www-form-urlencoded");
            }
        } else {
            finalUrl = appendQuery(rawUrl, params);
        }

        if (KEY_POST.equals(method)
                && StringUtils.isNotBlank(requestBody)
                && !containsHeader(headers, "Content-Type")) {
            headers.put("Content-Type", HttpOptionRule.DEFAULT_CONTENT_TYPE);
        }

        return new RequestContext(method, finalUrl, headers, requestBody);
    }

    private JsonNode executeRequest(RequestContext requestContext) throws Exception {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(requestContext.url).openConnection();
            connection.setRequestMethod(requestContext.method);
            connection.setInstanceFollowRedirects(true);
            connection.setConnectTimeout(PREVIEW_CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(PREVIEW_READ_TIMEOUT_MS);
            requestContext.headers.forEach(connection::setRequestProperty);

            if (KEY_POST.equals(requestContext.method)
                    && StringUtils.isNotBlank(requestContext.body)) {
                connection.setDoOutput(true);
                byte[] payload = requestContext.body.getBytes(StandardCharsets.UTF_8);
                try (OutputStream outputStream = connection.getOutputStream()) {
                    outputStream.write(payload);
                }
            }

            int status = connection.getResponseCode();
            byte[] responseBody =
                    readStream(
                            status >= 200 && status < 300
                                    ? connection.getInputStream()
                                    : connection.getErrorStream());
            if (status < 200 || status >= 300) {
                throw new IllegalStateException(
                        "HTTP status " + status + " returned from " + requestContext.url);
            }
            return parseJson(responseBody);
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
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

    private List<JsonNode> resolveContentNodes(
            JsonNode responseJson, String contentField, List<String> warnings) {
        if (StringUtils.isBlank(contentField)) {
            return Collections.singletonList(responseJson);
        }

        List<JsonNode> nodes = readJsonPath(responseJson, contentField);
        if (nodes.isEmpty()) {
            warnings.add("content_field did not match any data in the response");
        }
        return nodes;
    }

    private PreviewRowsResult buildPreviewRows(
            List<JsonNode> contentNodes,
            LinkedHashMap<String, String> jsonFieldConfig,
            boolean jsonFieldMissedReturnNull,
            List<String> warnings,
            int limit)
            throws Exception {
        List<JsonNode> rowNodes = flattenRowNodes(contentNodes, limit);
        if (rowNodes.isEmpty()) {
            return new PreviewRowsResult(new ArrayList<>(), new LinkedHashMap<>());
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        LinkedHashMap<String, String> fieldPathMap = new LinkedHashMap<>();
        for (JsonNode rowNode : rowNodes) {
            Map<String, Object> row =
                    jsonFieldConfig.isEmpty()
                            ? buildDefaultRow(rowNode, fieldPathMap)
                            : buildMappedRow(
                                    rowNode,
                                    jsonFieldConfig,
                                    jsonFieldMissedReturnNull,
                                    warnings,
                                    fieldPathMap);
            rows.add(row);
        }
        return new PreviewRowsResult(rows, fieldPathMap);
    }

    private List<JsonNode> flattenRowNodes(List<JsonNode> contentNodes, int limit) {
        List<JsonNode> rows = new ArrayList<>();
        for (JsonNode node : contentNodes) {
            if (node == null || node.isMissingNode() || node.isNull()) {
                continue;
            }
            if (node.isArray()) {
                for (JsonNode item : node) {
                    rows.add(item);
                    if (rows.size() >= limit) {
                        return rows;
                    }
                }
                continue;
            }
            rows.add(node);
            if (rows.size() >= limit) {
                return rows;
            }
        }
        return rows;
    }

    private Map<String, Object> buildDefaultRow(
            JsonNode rowNode, LinkedHashMap<String, String> fieldPathMap) throws Exception {
        Map<String, Object> row = new LinkedHashMap<>();
        if (rowNode == null || rowNode.isMissingNode() || rowNode.isNull()) {
            row.put("value", null);
            fieldPathMap.putIfAbsent("value", "value");
            return row;
        }
        if (rowNode.isObject()) {
            flattenObjectNode(rowNode, row, fieldPathMap, null);
            return row;
        }
        row.put("value", toPreviewValue(rowNode));
        fieldPathMap.putIfAbsent("value", "value");
        return row;
    }

    private void flattenObjectNode(
            JsonNode objectNode,
            Map<String, Object> row,
            LinkedHashMap<String, String> fieldPathMap,
            String parentPath)
            throws Exception {
        Iterator<Map.Entry<String, JsonNode>> fields = objectNode.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> entry = fields.next();
            String currentPath =
                    StringUtils.isBlank(parentPath)
                            ? entry.getKey()
                            : parentPath + "." + entry.getKey();
            appendFlattenedNode(entry.getValue(), row, fieldPathMap, currentPath);
        }
    }

    private void appendFlattenedNode(
            JsonNode node,
            Map<String, Object> row,
            LinkedHashMap<String, String> fieldPathMap,
            String fieldPath)
            throws Exception {
        String fieldName = ensureSafeFieldName(fieldPathMap, fieldPath);
        if (node == null || node.isNull() || node.isMissingNode()) {
            row.put(fieldName, null);
            return;
        }
        if (node.isObject()) {
            flattenObjectNode(node, row, fieldPathMap, fieldPath);
            return;
        }
        if (node.isArray()) {
            row.put(fieldName, OBJECT_MAPPER.writeValueAsString(node));
            return;
        }
        row.put(fieldName, toPreviewValue(node));
    }

    private Map<String, Object> buildMappedRow(
            JsonNode rowNode,
            LinkedHashMap<String, String> jsonFieldConfig,
            boolean jsonFieldMissedReturnNull,
            List<String> warnings,
            LinkedHashMap<String, String> fieldPathMap)
            throws Exception {
        Map<String, Object> row = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : jsonFieldConfig.entrySet()) {
            String targetFieldName = ensureSafeFieldName(fieldPathMap, entry.getKey());
            List<JsonNode> matchedNodes = readJsonPath(rowNode, entry.getValue());
            if (matchedNodes.isEmpty()) {
                warnings.add(
                        "json_field path did not match any value for field '"
                                + targetFieldName
                                + "'");
                row.put(targetFieldName, null);
                if (!jsonFieldMissedReturnNull) {
                    continue;
                }
                continue;
            }
            row.put(targetFieldName, toPreviewValue(matchedNodes));
        }
        return row;
    }

    private List<TableField> buildPreviewFields(
            List<Map<String, Object>> rows,
            List<HttpDatasourcePreviewFieldReq> schemaFields,
            LinkedHashMap<String, String> jsonFieldConfig,
            LinkedHashMap<String, String> fieldPathMap,
            List<String> warnings) {
        if (schemaFields != null && !schemaFields.isEmpty()) {
            return schemaFields.stream()
                    .filter(field -> StringUtils.isNotBlank(field.getName()))
                    .map(field -> normalizePreviewField(field, fieldPathMap))
                    .collect(Collectors.toList());
        }

        LinkedHashMap<String, String> inferredTypes = new LinkedHashMap<>();
        if (!jsonFieldConfig.isEmpty()) {
            jsonFieldConfig
                    .keySet()
                    .forEach(
                            key ->
                                    inferredTypes.put(
                                            ensureSafeFieldName(fieldPathMap, key), "STRING"));
        }
        for (Map<String, Object> row : rows) {
            for (Map.Entry<String, Object> entry : row.entrySet()) {
                inferredTypes.merge(
                        entry.getKey(), inferValueType(entry.getValue()), this::mergeFieldTypes);
            }
        }
        if (inferredTypes.isEmpty()) {
            warnings.add("No fields could be inferred from the HTTP response");
            return new ArrayList<>();
        }
        return inferredTypes.entrySet().stream()
                .map(
                        entry ->
                                buildField(
                                        entry.getKey(),
                                        entry.getValue(),
                                        fieldPathMap.get(entry.getKey())))
                .collect(Collectors.toList());
    }

    private List<Map<String, Object>> projectRows(
            List<Map<String, Object>> rows,
            List<TableField> fields,
            List<String> warnings,
            int limit) {
        if (fields.isEmpty()) {
            return rows.stream().limit(limit).collect(Collectors.toList());
        }
        List<Map<String, Object>> projectedRows = new ArrayList<>();
        for (Map<String, Object> row : rows.stream().limit(limit).collect(Collectors.toList())) {
            Map<String, Object> projectedRow = new LinkedHashMap<>();
            for (TableField field : fields) {
                projectedRow.put(field.getName(), row.get(field.getName()));
            }
            projectedRows.add(projectedRow);
        }
        if (rows.size() > limit) {
            warnings.add("Preview rows were truncated to the configured limit");
        }
        return projectedRows;
    }

    private TableField normalizePreviewField(
            HttpDatasourcePreviewFieldReq field, LinkedHashMap<String, String> fieldPathMap) {
        TableField tableField = new TableField();
        String fieldName = ensureSafeFieldName(fieldPathMap, field.getName());
        tableField.setName(fieldName);
        tableField.setType(
                StringUtils.defaultIfBlank(
                                StringUtils.defaultIfBlank(
                                        field.getOutputDataType(), field.getType()),
                                "STRING")
                        .toUpperCase());
        tableField.setNullable(field.getNullable() == null || field.getNullable());
        tableField.setPrimaryKey(Boolean.TRUE.equals(field.getPrimaryKey()));
        tableField.setDefaultValue(StringUtils.defaultString(field.getDefaultValue()));
        String fieldComment = StringUtils.defaultString(field.getComment());
        String originalPath = fieldPathMap.get(fieldName);
        tableField.setComment(
                StringUtils.isNotBlank(fieldComment)
                        ? fieldComment
                        : StringUtils.defaultString(originalPath));
        return tableField;
    }

    private TableField buildField(String name, String type, String originalPath) {
        TableField field = new TableField();
        field.setName(name);
        field.setType(type);
        field.setNullable(true);
        field.setPrimaryKey(false);
        field.setDefaultValue("");
        field.setComment(StringUtils.defaultString(originalPath));
        return field;
    }

    private String ensureSafeFieldName(
            LinkedHashMap<String, String> fieldPathMap, String rawFieldPath) {
        String normalized = NON_WORD_PATTERN.matcher(StringUtils.defaultString(rawFieldPath))
                .replaceAll("_");
        normalized = StringUtils.strip(normalized, "_");
        if (StringUtils.isBlank(normalized)) {
            normalized = "field";
        }

        String candidate = normalized;
        int suffix = 2;
        while (fieldPathMap.containsKey(candidate)
                && !StringUtils.equals(fieldPathMap.get(candidate), rawFieldPath)) {
            candidate = normalized + "_" + suffix;
            suffix++;
        }
        fieldPathMap.putIfAbsent(candidate, rawFieldPath);
        return candidate;
    }

    private String inferValueType(Object value) {
        if (value == null) {
            return "STRING";
        }
        if (value instanceof Boolean) {
            return "BOOLEAN";
        }
        if (value instanceof Byte
                || value instanceof Short
                || value instanceof Integer
                || value instanceof Long) {
            return "BIGINT";
        }
        if (value instanceof Float || value instanceof Double) {
            return "DOUBLE";
        }
        return "STRING";
    }

    private String mergeFieldTypes(String left, String right) {
        if (StringUtils.equals(left, right)) {
            return left;
        }
        List<String> numericTypes = Arrays.asList("BIGINT", "DOUBLE");
        if (numericTypes.contains(left) && numericTypes.contains(right)) {
            return "DOUBLE";
        }
        return "STRING";
    }

    private Object toPreviewValue(JsonNode node) throws Exception {
        if (node == null || node.isNull() || node.isMissingNode()) {
            return null;
        }
        if (node.isValueNode()) {
            return OBJECT_MAPPER.treeToValue(node, Object.class);
        }
        return OBJECT_MAPPER.writeValueAsString(node);
    }

    private Object toPreviewValue(List<JsonNode> nodes) throws Exception {
        if (nodes == null || nodes.isEmpty()) {
            return null;
        }
        if (nodes.size() == 1) {
            return toPreviewValue(nodes.get(0));
        }
        List<Object> values = new ArrayList<>();
        for (JsonNode node : nodes) {
            values.add(toPreviewValue(node));
        }
        return OBJECT_MAPPER.writeValueAsString(values);
    }

    private LinkedHashMap<String, String> parseMapConfig(Object rawValue) {
        if (rawValue == null) {
            return new LinkedHashMap<>();
        }
        if (rawValue instanceof Map) {
            LinkedHashMap<String, String> result = new LinkedHashMap<>();
            ((Map<?, ?>) rawValue)
                    .forEach(
                            (key, value) ->
                                    result.put(
                                            String.valueOf(key),
                                            value == null ? null : String.valueOf(value)));
            return result;
        }
        String rawText = String.valueOf(rawValue);
        if (StringUtils.isBlank(rawText)) {
            return new LinkedHashMap<>();
        }
        String trimmed = rawText.trim();
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

    private List<JsonNode> readJsonPath(JsonNode root, String path) {
        if (root == null || StringUtils.isBlank(path)) {
            return Collections.emptyList();
        }
        String normalized = path.trim();
        if ("$".equals(normalized)) {
            return Collections.singletonList(root);
        }

        List<PathToken> tokens = parsePathTokens(normalized);
        if (tokens.isEmpty()) {
            return Collections.emptyList();
        }

        List<JsonNode> current = new ArrayList<>();
        current.add(root);
        for (PathToken token : tokens) {
            List<JsonNode> next = new ArrayList<>();
            for (JsonNode node : current) {
                if (node == null || node.isNull() || node.isMissingNode()) {
                    continue;
                }
                switch (token.type) {
                    case PROPERTY:
                        if (node.isObject() && node.has(token.value)) {
                            next.add(node.get(token.value));
                        }
                        break;
                    case INDEX:
                        if (node.isArray() && node.size() > token.index && token.index >= 0) {
                            next.add(node.get(token.index));
                        }
                        break;
                    case WILDCARD:
                        if (node.isArray()) {
                            node.forEach(next::add);
                        } else if (node.isObject()) {
                            node.elements().forEachRemaining(next::add);
                        }
                        break;
                    default:
                        break;
                }
            }
            current = next;
            if (current.isEmpty()) {
                return Collections.emptyList();
            }
        }
        return current;
    }

    private List<PathToken> parsePathTokens(String path) {
        String normalized = path.trim();
        if (normalized.startsWith("$")) {
            normalized = normalized.substring(1);
        }
        List<PathToken> tokens = new ArrayList<>();
        int index = 0;
        while (index < normalized.length()) {
            char current = normalized.charAt(index);
            if (current == '.') {
                index++;
                continue;
            }
            if (current == '[') {
                int end = normalized.indexOf(']', index);
                if (end < 0) {
                    return Collections.emptyList();
                }
                String content = normalized.substring(index + 1, end).trim();
                if ("*".equals(content)) {
                    tokens.add(PathToken.wildcard());
                } else if ((content.startsWith("'") && content.endsWith("'"))
                        || (content.startsWith("\"") && content.endsWith("\""))) {
                    tokens.add(PathToken.property(content.substring(1, content.length() - 1)));
                } else {
                    try {
                        tokens.add(PathToken.index(Integer.parseInt(content)));
                    } catch (NumberFormatException ignore) {
                        tokens.add(PathToken.property(content));
                    }
                }
                index = end + 1;
                continue;
            }

            int nextDot = normalized.indexOf('.', index);
            int nextBracket = normalized.indexOf('[', index);
            int end = normalized.length();
            if (nextDot >= 0) {
                end = Math.min(end, nextDot);
            }
            if (nextBracket >= 0) {
                end = Math.min(end, nextBracket);
            }
            String property = normalized.substring(index, end).trim();
            if (StringUtils.isNotBlank(property)) {
                tokens.add(PathToken.property(property));
            }
            index = end;
        }
        return tokens;
    }

    private void applyPagingDefaults(
            Map<String, String> pagingParams, Map<String, Object> connectorConfig) {
        String startPageNumber = getConfigString(connectorConfig, KEY_START_PAGE_NUMBER);
        if (StringUtils.isBlank(startPageNumber)) {
            startPageNumber = "1";
        }
        pagingParams.putIfAbsent("page", startPageNumber);
        String pageField = getConfigString(connectorConfig, KEY_PAGE_FIELD);
        if (StringUtils.isNotBlank(pageField)) {
            pagingParams.putIfAbsent(pageField, startPageNumber);
        }
    }

    private String replacePlaceholders(
            String value, Map<String, String> placeholders, boolean usePlaceholderReplacement) {
        if (StringUtils.isBlank(value) || placeholders.isEmpty()) {
            return value;
        }
        String result = value;
        for (Map.Entry<String, String> entry : placeholders.entrySet()) {
            String placeholder =
                    usePlaceholderReplacement
                            ? "${" + entry.getKey() + "}"
                            : "${" + entry.getKey() + "}";
            result =
                    StringUtils.replace(
                            result, placeholder, StringUtils.defaultString(entry.getValue()));
        }
        return result;
    }

    private String buildFormBody(Map<String, String> params) {
        return params.entrySet().stream()
                .map(
                        entry ->
                                encode(entry.getKey())
                                        + "="
                                        + encode(StringUtils.defaultString(entry.getValue())))
                .collect(Collectors.joining("&"));
    }

    private String appendQuery(String rawUrl, Map<String, String> params) {
        if (params.isEmpty()) {
            return rawUrl;
        }
        String query = buildFormBody(params);
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

    private boolean containsHeader(Map<String, String> headers, String expectedHeader) {
        return headers.keySet().stream().anyMatch(key -> expectedHeader.equalsIgnoreCase(key));
    }

    private String requireText(Map<String, String> config, String key, String label) {
        String value = config.get(key);
        if (StringUtils.isBlank(value)) {
            throw new IllegalArgumentException(label + " must not be empty");
        }
        return value.trim();
    }

    private String getConfigString(Map<String, Object> config, String key) {
        Object value = config.get(key);
        return value == null ? null : StringUtils.trimToNull(String.valueOf(value));
    }

    private boolean getConfigBoolean(Map<String, Object> config, String key) {
        Object value = config.get(key);
        if (value == null) {
            return false;
        }
        if (value instanceof Boolean) {
            return (Boolean) value;
        }
        return Boolean.parseBoolean(String.valueOf(value));
    }

    private int defaultInt(Integer value, int defaultValue) {
        return value == null ? defaultValue : value;
    }

    private List<String> deduplicateWarnings(List<String> warnings) {
        return warnings.stream()
                .filter(StringUtils::isNotBlank)
                .distinct()
                .collect(Collectors.toList());
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

    private static final class PreviewRowsResult {
        private final List<Map<String, Object>> rows;
        private final LinkedHashMap<String, String> fieldPathMap;

        private PreviewRowsResult(
                List<Map<String, Object>> rows, LinkedHashMap<String, String> fieldPathMap) {
            this.rows = rows;
            this.fieldPathMap = fieldPathMap;
        }
    }

    private enum PathTokenType {
        PROPERTY,
        INDEX,
        WILDCARD
    }

    private static final class PathToken {
        private final PathTokenType type;
        private final String value;
        private final int index;

        private PathToken(PathTokenType type, String value, int index) {
            this.type = type;
            this.value = value;
            this.index = index;
        }

        private static PathToken property(String value) {
            return new PathToken(PathTokenType.PROPERTY, value, -1);
        }

        private static PathToken index(int index) {
            return new PathToken(PathTokenType.INDEX, null, index);
        }

        private static PathToken wildcard() {
            return new PathToken(PathTokenType.WILDCARD, null, -1);
        }
    }
}

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

import org.apache.seatunnel.shade.com.fasterxml.jackson.core.JsonProcessingException;
import org.apache.seatunnel.shade.com.fasterxml.jackson.databind.JsonNode;
import org.apache.seatunnel.shade.com.fasterxml.jackson.databind.ObjectMapper;

import org.apache.seatunnel.datasource.plugin.api.DataSourcePluginException;
import org.apache.seatunnel.datasource.plugin.api.model.TableField;

import org.apache.commons.lang3.StringUtils;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class LocalFileSchemaUtils {

    private static final int SAMPLE_LIMIT = 100;
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    public static List<TableField> inferFields(
            String path,
            String fileFormatType,
            String encoding,
            boolean csvUseHeaderLine,
            int skipHeaderRowNumber) {
        String normalizedFormat = normalizeFormat(fileFormatType, path);
        File file = new File(path);
        validateReadableSupportedFile(file, normalizedFormat);
        try {
            if (LocalFileOptionRule.JSON_FORMAT.equals(normalizedFormat)) {
                return inferJsonFields(file, normalizeEncoding(encoding));
            }
            return inferCsvFields(
                    file, normalizeEncoding(encoding), csvUseHeaderLine, skipHeaderRowNumber);
        } catch (DataSourcePluginException e) {
            throw e;
        } catch (IOException e) {
            throw new DataSourcePluginException("Infer local file schema failed: " + path, e);
        }
    }

    /**
     * Read JSON records from a local file. Supports a whole JSON object/array document and JSON
     * Lines (one JSON object per line).
     */
    public static List<JsonNode> readJsonObjectNodes(File file, String encoding, int limit)
            throws IOException {
        String normalizedEncoding = normalizeEncoding(encoding);
        String content =
                new String(Files.readAllBytes(file.toPath()), Charset.forName(normalizedEncoding));
        String trimmed = content.trim();
        List<JsonNode> nodes = new ArrayList<>();
        if (StringUtils.isNotBlank(trimmed)) {
            try {
                JsonNode root = OBJECT_MAPPER.readTree(trimmed);
                collectJsonObjectNodes(root, nodes, limit);
                if (!nodes.isEmpty()) {
                    return nodes;
                }
            } catch (JsonProcessingException ignored) {
                // Fall back to JSON Lines parsing below.
            }
        }

        JsonProcessingException lastParseError = null;
        try (BufferedReader reader =
                Files.newBufferedReader(file.toPath(), Charset.forName(normalizedEncoding))) {
            String line;
            while ((line = reader.readLine()) != null && nodes.size() < limit) {
                if (StringUtils.isBlank(line)) {
                    continue;
                }
                try {
                    JsonNode jsonNode = OBJECT_MAPPER.readTree(line);
                    collectJsonObjectNodes(jsonNode, nodes, limit);
                } catch (JsonProcessingException e) {
                    lastParseError = e;
                }
            }
        }
        if (nodes.isEmpty() && lastParseError != null) {
            throw new DataSourcePluginException(
                    "Invalid JSON file, use standard JSON (object/array) or JSON Lines format: "
                            + file.getPath()
                            + ", "
                            + lastParseError.getOriginalMessage(),
                    lastParseError);
        }
        return nodes;
    }

    private static void collectJsonObjectNodes(JsonNode root, List<JsonNode> nodes, int limit) {
        if (root == null || nodes.size() >= limit) {
            return;
        }
        if (root.isArray()) {
            for (JsonNode item : root) {
                if (nodes.size() >= limit) {
                    break;
                }
                if (item != null && item.isObject()) {
                    nodes.add(item);
                }
            }
            return;
        }
        if (root.isObject()) {
            nodes.add(root);
        }
    }

    public static void validateReadableSupportedFile(File file, String fileFormatType) {
        if (file == null || !file.exists()) {
            throw new DataSourcePluginException("Local file does not exist");
        }
        if (!file.isFile()) {
            throw new DataSourcePluginException("Local file path must be a regular file");
        }
        if (!file.canRead()) {
            throw new DataSourcePluginException("Local file is not readable");
        }
        String normalizedFormat = normalizeFormat(fileFormatType, file.getName());
        String suffix = getFileSuffix(file.getName());
        if (!LocalFileOptionRule.CSV_FORMAT.equals(normalizedFormat)
                && !LocalFileOptionRule.JSON_FORMAT.equals(normalizedFormat)) {
            throw new DataSourcePluginException("Only csv and json local files are supported");
        }
        if (StringUtils.isNotBlank(suffix) && !normalizedFormat.equals(suffix)) {
            throw new DataSourcePluginException("File suffix does not match file_format_type");
        }
    }

    public static String normalizeFormat(String fileFormatType, String path) {
        if (StringUtils.isNotBlank(fileFormatType)) {
            return fileFormatType.trim().toLowerCase();
        }
        return getFileSuffix(path);
    }

    public static String normalizeEncoding(String encoding) {
        return StringUtils.isBlank(encoding) ? LocalFileOptionRule.DEFAULT_ENCODING : encoding;
    }

    public static String getFileSuffix(String path) {
        if (StringUtils.isBlank(path)) {
            return "";
        }
        String fileName = new File(path).getName();
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == fileName.length() - 1) {
            return "";
        }
        return fileName.substring(dotIndex + 1).toLowerCase();
    }

    public static String tableNameFromPath(String path) {
        if (StringUtils.isBlank(path)) {
            return "local_file";
        }
        String fileName = new File(path).getName();
        int dotIndex = fileName.lastIndexOf('.');
        String baseName = dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
        String normalized = baseName.replaceAll("[^A-Za-z0-9_]", "_");
        return StringUtils.isBlank(normalized) ? "local_file" : normalized;
    }

    public static String toSchemaConfig(List<TableField> fields) {
        StringBuilder builder = new StringBuilder("fields {\n");
        for (TableField field : fields) {
            builder.append("  ")
                    .append(quoteKey(field.getName()))
                    .append(" = ")
                    .append(normalizeSeaTunnelType(field.getOutputDataType()))
                    .append("\n");
        }
        builder.append("}");
        return builder.toString();
    }

    private static List<TableField> inferCsvFields(
            File file, String encoding, boolean csvUseHeaderLine, int skipHeaderRowNumber)
            throws IOException {
        List<String> headers = new ArrayList<>();
        List<List<String>> rows = new ArrayList<>();
        try (BufferedReader reader =
                Files.newBufferedReader(file.toPath(), Charset.forName(encoding))) {
            String line;
            int lineNumber = 0;
            while ((line = reader.readLine()) != null && rows.size() < SAMPLE_LIMIT) {
                lineNumber++;
                if (lineNumber <= Math.max(skipHeaderRowNumber, 0)) {
                    continue;
                }
                List<String> values = parseCsvLine(line);
                if (csvUseHeaderLine && headers.isEmpty()) {
                    headers.addAll(normalizeHeaders(values));
                    continue;
                }
                if (headers.isEmpty()) {
                    for (int i = 0; i < values.size(); i++) {
                        headers.add("column_" + (i + 1));
                    }
                }
                while (headers.size() < values.size()) {
                    headers.add("column_" + (headers.size() + 1));
                }
                rows.add(values);
            }
        }
        return buildFields(headers, rows);
    }

    private static List<TableField> inferJsonFields(File file, String encoding) throws IOException {
        Map<String, String> fieldTypes = new LinkedHashMap<>();
        for (JsonNode node : readJsonObjectNodes(file, encoding, SAMPLE_LIMIT)) {
            mergeJsonObjectFields(fieldTypes, node);
        }
        return toTableFields(fieldTypes);
    }

    private static void mergeJsonObjectFields(Map<String, String> fieldTypes, JsonNode node) {
        if (node == null || !node.isObject()) {
            return;
        }
        node.fields()
                .forEachRemaining(
                        entry -> {
                            String fieldName =
                                    normalizeFieldName(entry.getKey(), fieldTypes.size());
                            String type = inferJsonNodeType(entry.getValue());
                            fieldTypes.merge(fieldName, type, LocalFileSchemaUtils::mergeType);
                        });
    }

    private static List<TableField> buildFields(List<String> headers, List<List<String>> rows) {
        Map<String, String> typeMap = new LinkedHashMap<>();
        for (String header : headers) {
            typeMap.put(header, "INT");
        }
        for (List<String> row : rows) {
            for (int i = 0; i < headers.size(); i++) {
                String value = i < row.size() ? row.get(i) : null;
                String inferred = inferStringType(value);
                String fieldName = headers.get(i);
                typeMap.put(fieldName, mergeType(typeMap.get(fieldName), inferred));
            }
        }
        return toTableFields(typeMap);
    }

    private static List<TableField> toTableFields(Map<String, String> typeMap) {
        List<TableField> fields = new ArrayList<>();
        typeMap.forEach(
                (name, type) -> {
                    TableField tableField = new TableField();
                    tableField.setName(name);
                    tableField.setType(type);
                    tableField.setOutputDataType(type);
                    tableField.setNullable(true);
                    tableField.setPrimaryKey(false);
                    tableField.setDefaultValue("");
                    tableField.setComment("");
                    tableField.setUnSupport(false);
                    fields.add(tableField);
                });
        return fields;
    }

    private static List<String> normalizeHeaders(List<String> headers) {
        List<String> normalizedHeaders = new ArrayList<>();
        for (int i = 0; i < headers.size(); i++) {
            normalizedHeaders.add(normalizeFieldName(headers.get(i), i));
        }
        return normalizedHeaders;
    }

    private static String normalizeFieldName(String rawName, int index) {
        String name = StringUtils.defaultString(rawName).trim().replaceAll("[^A-Za-z0-9_]", "_");
        return StringUtils.isBlank(name) ? "column_" + (index + 1) : name;
    }

    private static List<String> parseCsvLine(String line) {
        List<String> result = new ArrayList<>();
        StringBuilder value = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char current = line.charAt(i);
            if (current == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    value.append('"');
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }
            if (current == ',' && !inQuotes) {
                result.add(value.toString());
                value.setLength(0);
                continue;
            }
            value.append(current);
        }
        result.add(value.toString());
        return result;
    }

    private static String inferStringType(String value) {
        if (StringUtils.isBlank(value)) {
            return "INT";
        }
        String trimmed = value.trim();
        if ("true".equalsIgnoreCase(trimmed) || "false".equalsIgnoreCase(trimmed)) {
            return "BOOLEAN";
        }
        if (trimmed.matches("[-+]?\\d+")) {
            try {
                Integer.parseInt(trimmed);
                return "INT";
            } catch (NumberFormatException ignored) {
                return "BIGINT";
            }
        }
        if (trimmed.matches("[-+]?\\d*\\.\\d+([eE][-+]?\\d+)?")
                || trimmed.matches("[-+]?\\d+[eE][-+]?\\d+")) {
            return "DOUBLE";
        }
        return "STRING";
    }

    private static String inferJsonNodeType(JsonNode node) {
        if (node == null || node.isNull()) {
            return "INT";
        }
        if (node.isBoolean()) {
            return "BOOLEAN";
        }
        if (node.isInt()) {
            return "INT";
        }
        if (node.isLong() || node.isIntegralNumber()) {
            return "BIGINT";
        }
        if (node.isNumber()) {
            return "DOUBLE";
        }
        return "STRING";
    }

    private static String mergeType(String current, String incoming) {
        if (StringUtils.isBlank(current)) {
            return incoming;
        }
        if (current.equals(incoming)) {
            return current;
        }
        if ("STRING".equals(current) || "STRING".equals(incoming)) {
            return "STRING";
        }
        if ("DOUBLE".equals(current) || "DOUBLE".equals(incoming)) {
            return "DOUBLE";
        }
        if ("BIGINT".equals(current) || "BIGINT".equals(incoming)) {
            return "BIGINT";
        }
        if ("BOOLEAN".equals(current) || "BOOLEAN".equals(incoming)) {
            return "STRING";
        }
        return incoming;
    }

    private static String normalizeSeaTunnelType(String type) {
        String normalized = StringUtils.defaultIfBlank(type, "STRING").trim().toLowerCase();
        if ("integer".equals(normalized)) {
            return "int";
        }
        return normalized;
    }

    private static String quoteKey(String key) {
        return "\""
                + StringUtils.defaultString(key).replace("\\", "\\\\").replace("\"", "\\\"")
                + "\"";
    }

    private LocalFileSchemaUtils() {}
}

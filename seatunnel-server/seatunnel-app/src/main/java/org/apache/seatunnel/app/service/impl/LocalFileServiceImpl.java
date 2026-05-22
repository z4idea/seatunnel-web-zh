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

import org.apache.seatunnel.app.domain.request.localfile.LocalFilePreviewReq;
import org.apache.seatunnel.app.domain.response.localfile.LocalFileEntryRes;
import org.apache.seatunnel.app.domain.response.localfile.LocalFilePreviewRes;
import org.apache.seatunnel.app.service.ILocalFileService;
import org.apache.seatunnel.datasource.plugin.api.model.TableField;
import org.apache.seatunnel.datasource.plugin.localfile.LocalFileOptionRule;
import org.apache.seatunnel.datasource.plugin.localfile.LocalFileSchemaUtils;
import org.apache.seatunnel.server.common.SeatunnelErrorEnum;
import org.apache.seatunnel.server.common.SeatunnelException;

import org.apache.commons.lang3.StringUtils;

import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class LocalFileServiceImpl implements ILocalFileService {

    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 200;
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Override
    public List<LocalFileEntryRes> roots() {
        File[] roots = File.listRoots();
        if (roots == null || roots.length == 0) {
            return Arrays.asList(buildEntry(new File(File.separator)));
        }
        return Arrays.stream(roots).map(this::buildEntry).collect(Collectors.toList());
    }

    @Override
    public List<LocalFileEntryRes> list(String path) {
        if (StringUtils.isBlank(path)) {
            return roots();
        }
        File directory = new File(path);
        if (!directory.exists()) {
            throw new SeatunnelException(SeatunnelErrorEnum.ILLEGAL_STATE, "Path does not exist");
        }
        if (!directory.isDirectory()) {
            directory = directory.getParentFile();
        }
        if (directory == null || !directory.canRead()) {
            return new ArrayList<>();
        }
        File[] files = directory.listFiles();
        if (files == null) {
            return new ArrayList<>();
        }
        return Arrays.stream(files)
                .filter(File::canRead)
                .sorted(
                        Comparator.comparing(File::isFile)
                                .thenComparing(file -> file.getName().toLowerCase()))
                .map(this::buildEntry)
                .collect(Collectors.toList());
    }

    @Override
    public LocalFilePreviewRes preview(LocalFilePreviewReq req) {
        File file = new File(req.getPath());
        String format =
                LocalFileSchemaUtils.normalizeFormat(req.getFileFormatType(), req.getPath());
        LocalFileSchemaUtils.validateReadableSupportedFile(file, format);
        String encoding = LocalFileSchemaUtils.normalizeEncoding(req.getEncoding());
        boolean csvUseHeaderLine = !Boolean.FALSE.equals(req.getCsvUseHeaderLine());
        int skipHeaderRowNumber = Math.max(defaultInt(req.getSkipHeaderRowNumber(), 0), 0);
        int limit = Math.min(Math.max(defaultInt(req.getLimit(), DEFAULT_LIMIT), 1), MAX_LIMIT);

        List<String> warnings = new ArrayList<>();
        try {
            List<TableField> fields =
                    LocalFileSchemaUtils.inferFields(
                            req.getPath(), format, encoding, csvUseHeaderLine, skipHeaderRowNumber);
            List<Map<String, Object>> rows =
                    LocalFileOptionRule.JSON_FORMAT.equals(format)
                            ? previewJson(file, encoding, fields, limit)
                            : previewCsv(
                                    file,
                                    encoding,
                                    fields,
                                    csvUseHeaderLine,
                                    skipHeaderRowNumber,
                                    limit);
            if (fields.isEmpty()) {
                warnings.add("No schema fields were inferred from this file");
            }
            if (rows.isEmpty()) {
                warnings.add("No preview rows were read from this file");
            }
            return LocalFilePreviewRes.builder()
                    .fields(fields)
                    .rows(rows)
                    .warnings(warnings)
                    .build();
        } catch (IOException | RuntimeException e) {
            throw new SeatunnelException(
                    SeatunnelErrorEnum.ILLEGAL_STATE,
                    "Preview local file failed: " + e.getMessage());
        }
    }

    private List<Map<String, Object>> previewCsv(
            File file,
            String encoding,
            List<TableField> fields,
            boolean csvUseHeaderLine,
            int skipHeaderRowNumber,
            int limit)
            throws IOException {
        List<Map<String, Object>> rows = new ArrayList<>();
        try (BufferedReader reader =
                Files.newBufferedReader(file.toPath(), Charset.forName(encoding))) {
            String line;
            int lineNumber = 0;
            boolean headerConsumed = !csvUseHeaderLine;
            while ((line = reader.readLine()) != null && rows.size() < limit) {
                lineNumber++;
                if (lineNumber <= skipHeaderRowNumber) {
                    continue;
                }
                if (!headerConsumed) {
                    headerConsumed = true;
                    continue;
                }
                List<String> values = parseCsvLine(line);
                Map<String, Object> row = new LinkedHashMap<>();
                for (int i = 0; i < fields.size(); i++) {
                    row.put(fields.get(i).getName(), i < values.size() ? values.get(i) : null);
                }
                rows.add(row);
            }
        }
        return rows;
    }

    private List<Map<String, Object>> previewJson(
            File file, String encoding, List<TableField> fields, int limit) throws IOException {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (JsonNode node : LocalFileSchemaUtils.readJsonObjectNodes(file, encoding, limit)) {
            rows.add(toPreviewRow(node, fields));
        }
        return rows;
    }

    private Map<String, Object> toPreviewRow(JsonNode node, List<TableField> fields)
            throws IOException {
        Map<String, Object> row = new LinkedHashMap<>();
        for (TableField field : fields) {
            JsonNode value = node == null || !node.isObject() ? null : node.get(field.getName());
            if (value == null || value.isNull()) {
                row.put(field.getName(), null);
            } else if (value.isValueNode()) {
                row.put(field.getName(), OBJECT_MAPPER.treeToValue(value, Object.class));
            } else {
                row.put(field.getName(), OBJECT_MAPPER.writeValueAsString(value));
            }
        }
        return row;
    }

    private LocalFileEntryRes buildEntry(File file) {
        String format = file.isFile() ? LocalFileSchemaUtils.getFileSuffix(file.getName()) : "";
        boolean selectable =
                file.isFile()
                        && file.canRead()
                        && (LocalFileOptionRule.CSV_FORMAT.equals(format)
                                || LocalFileOptionRule.JSON_FORMAT.equals(format));
        return LocalFileEntryRes.builder()
                .name(resolveFileName(file))
                .path(file.getAbsolutePath())
                .directory(file.isDirectory())
                .readable(file.canRead())
                .size(file.isFile() ? file.length() : 0L)
                .lastModified(file.lastModified())
                .fileFormatType(selectable ? format : "")
                .selectable(selectable)
                .build();
    }

    private String resolveFileName(File file) {
        String name = file.getName();
        return StringUtils.isBlank(name) ? file.getAbsolutePath() : name;
    }

    private int defaultInt(Integer value, int defaultValue) {
        return value == null ? defaultValue : value;
    }

    private List<String> parseCsvLine(String line) {
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
}

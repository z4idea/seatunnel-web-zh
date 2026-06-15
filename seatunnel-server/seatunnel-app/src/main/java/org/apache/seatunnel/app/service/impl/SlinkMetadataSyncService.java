/*
 * @author: zhjj
 *
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

import org.apache.seatunnel.shade.com.typesafe.config.Config;
import org.apache.seatunnel.shade.com.typesafe.config.ConfigException;
import org.apache.seatunnel.shade.com.typesafe.config.ConfigFactory;
import org.apache.seatunnel.shade.com.typesafe.config.ConfigValueType;

import org.apache.seatunnel.app.dal.entity.JobInstance;

import org.apache.commons.lang3.StringUtils;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import lombok.extern.slf4j.Slf4j;

import javax.annotation.Resource;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class SlinkMetadataSyncService {

    private static final String SLINK_DATASOURCE_ORIGIN = "SLINK";
    private static final String DATASOURCE_LINK_KEY = "datasourceLinkDTO";

    @Resource private RestTemplate restTemplate;

    @Value("${seatunnel-web.slink.metadata-sync.base-url:http://192.168.76.134:17081}")
    //@Value("${seatunnel-web.slink.metadata-sync.base-url:http://192.168.73.230:48080}")
    private String baseUrl;

    @Value("${seatunnel-web.slink.metadata-sync.path:/admin-api/data/metadata/sync}")
    private String syncPath;

    public void syncFinishedJobMetadata(JobInstance jobInstance) {
        if (jobInstance == null || StringUtils.isBlank(jobInstance.getJobConfig())) {
            return;
        }

        List<Map<String, Object>> requests =
                extractSyncRequests(jobInstance.getJobConfig(), jobInstance.getId());
        if (requests.isEmpty()) {
            return;
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String url = buildSyncUrl();
        log.info("url: {}", url);
        for (Map<String, Object> requestBody : requests) {
            try {
                restTemplate.postForEntity(
                        url, new HttpEntity<>(requestBody, headers), String.class);
                log.info("完成调用");
            } catch (Exception e) {
                log.error(
                        "Failed to sync SLink metadata, jobInstanceId={}, tableName={}",
                        jobInstance.getId(),
                        requestBody.get("tableName"),
                        e);
            }
        }
    }

    private List<Map<String, Object>> extractSyncRequests(String jobConfig, Long jobInstanceId) {
        List<Map<String, Object>> requests = new ArrayList<>();
        try {
            Config config = ConfigFactory.parseString(jobConfig);
            if (!config.hasPath("sink")) {
                return requests;
            }

            List<Config> sinkEntries = getSinkEntries(config);
            for (Config sinkEntry : sinkEntries) {
                if (looksLikeConnectorConfig(sinkEntry)) {
                    appendSyncRequest(requests, sinkEntry, "sink", jobInstanceId);
                    continue;
                }
                for (String connectorName : sinkEntry.root().keySet()) {
                    appendSyncRequest(
                            requests,
                            sinkEntry.getConfig(connectorName),
                            connectorName,
                            jobInstanceId);
                }
            }
        } catch (Exception e) {
            log.error(
                    "Failed to parse SLink metadata sync config, jobInstanceId={}",
                    jobInstanceId,
                    e);
        }
        return requests;
    }

    private void appendSyncRequest(
            List<Map<String, Object>> requests,
            Config connectorConfig,
            String connectorName,
            Long jobInstanceId) {
        if (!StringUtils.equalsIgnoreCase(
                readOptionalString(connectorConfig, "datasourceOrigin"), SLINK_DATASOURCE_ORIGIN)) {
            return;
        }

        Map<String, Object> requestBody = buildRequestBody(connectorConfig);
        if (requestBody == null) {
            log.warn(
                    "Skip SLink metadata sync because sink config is incomplete, jobInstanceId={}, connector={}",
                    jobInstanceId,
                    connectorName);
            return;
        }
        requests.add(requestBody);
    }

    private List<Config> getSinkEntries(Config config) {
        List<Config> sinkEntries = new ArrayList<>();
        ConfigValueType sinkType = config.getValue("sink").valueType();
        if (ConfigValueType.LIST == sinkType) {
            sinkEntries.addAll(config.getConfigList("sink"));
            return sinkEntries;
        }
        sinkEntries.add(config.getConfig("sink"));
        return sinkEntries;
    }

    private boolean looksLikeConnectorConfig(Config config) {
        return config.hasPath("datasourceOrigin")
                || config.hasPath("table")
                || config.hasPath("url")
                || config.hasPath("jdbcUrl");
    }

    private Map<String, Object> buildRequestBody(Config connectorConfig) {
        String rawTableName = readOptionalString(connectorConfig, "table");

        String tableName = rawTableName;
        String schema = null;

        if (StringUtils.contains(rawTableName, ".")) {
            String[] parts = StringUtils.split(rawTableName, ".", 2);
            schema = parts[0];
            tableName = parts[1];
        }

        String jdbcUrl =
                firstNonBlank(
                        readOptionalString(connectorConfig, "url"),
                        readOptionalString(connectorConfig, "jdbcUrl"));

        if (StringUtils.isNotBlank(schema)
                && StringUtils.startsWithIgnoreCase(jdbcUrl, "jdbc:dm://")) {
            jdbcUrl = appendDmSchemaToJdbcUrl(jdbcUrl, schema);
        }

        String driver = readOptionalString(connectorConfig, "driver");
        String username =
                firstNonBlank(
                        readOptionalString(connectorConfig, "user"),
                        readOptionalString(connectorConfig, "username"));
        String password = readOptionalString(connectorConfig, "password");

        if (StringUtils.isAnyBlank(tableName, jdbcUrl, driver, username, password)) {
            return null;
        }

        Map<String, Object> datasourceLink = new LinkedHashMap<>();
        datasourceLink.put("jdbcUrl", jdbcUrl);
        datasourceLink.put("driver", driver);
        datasourceLink.put("username", username);
        datasourceLink.put("password", password);

        Map<String, Object> requestBody = new LinkedHashMap<>();
        requestBody.put("tableName", tableName);
        requestBody.put("tableComment", readOptionalString(connectorConfig, "tableComment"));
        requestBody.put(DATASOURCE_LINK_KEY, datasourceLink);
        return requestBody;
    }

    private String appendDmSchemaToJdbcUrl(String jdbcUrl, String schema) {
        if (StringUtils.containsIgnoreCase(jdbcUrl, "schema=")) {
            return jdbcUrl;
        }

        String separator = StringUtils.contains(jdbcUrl, "?") ? "&" : "?";
        return jdbcUrl + separator + "schema=" + schema;
    }

    private String buildSyncUrl() {
        return StringUtils.removeEnd(StringUtils.defaultString(baseUrl), "/")
                + StringUtils.prependIfMissing(StringUtils.defaultString(syncPath), "/");
    }

    private String firstNonBlank(String first, String second) {
        return StringUtils.isNotBlank(first) ? first : second;
    }

    private String readOptionalString(Config config, String path) {
        try {
            return config.hasPath(path) ? config.getString(path) : null;
        } catch (ConfigException.WrongType e) {
            return String.valueOf(config.getAnyRef(path));
        }
    }
}

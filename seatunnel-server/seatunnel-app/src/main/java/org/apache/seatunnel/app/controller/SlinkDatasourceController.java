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

package org.apache.seatunnel.app.controller;

import org.apache.seatunnel.app.common.Result;
import org.apache.seatunnel.app.domain.request.datasource.DatasourceReq;
import org.apache.seatunnel.app.domain.response.PageInfo;
import org.apache.seatunnel.app.domain.response.datasource.DatasourceDetailRes;
import org.apache.seatunnel.app.domain.response.datasource.DatasourceRes;
import org.apache.seatunnel.app.service.IDatasourceService;
import org.apache.seatunnel.common.utils.JsonUtils;

import org.apache.commons.lang3.StringUtils;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.annotations.ApiOperation;

import javax.annotation.Resource;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/seatunnel/api/v1/slink/datasource")
public class SlinkDatasourceController extends BaseController {

    private static final String JDBC_MYSQL_PLUGIN_NAME = "JDBC-Mysql";
    private static final String JDBC_ORACLE_PLUGIN_NAME = "JDBC-Oracle";
    private static final String JDBC_DM_PLUGIN_NAME = "JDBC-DM";
    private static final String JDBC_POSTGRES_PLUGIN_NAME = "JDBC-Postgres";
    private static final String JDBC_SQLSERVER_PLUGIN_NAME = "JDBC-SQLServer";
    private static final String JDBC_DB2_PLUGIN_NAME = "JDBC-Db2";
    private static final String URL_KEY = "url";
    private static final String HOST_KEY = "host";
    private static final String PORT_KEY = "port";
    private static final String DATABASE_KEY = "database";
    private static final String SCHEMA_KEY = "schema";
    private static final String DRIVER_KEY = "driver";
    private static final String MYSQL_JDBC_DRIVER = "com.mysql.cj.jdbc.Driver";
    private static final String ORACLE_JDBC_DRIVER = "oracle.jdbc.driver.OracleDriver";
    private static final String DM_JDBC_DRIVER = "dm.jdbc.driver.DmDriver";
    private static final String POSTGRES_JDBC_DRIVER = "org.postgresql.Driver";
    private static final String SQLSERVER_JDBC_DRIVER =
            "com.microsoft.sqlserver.jdbc.SQLServerDriver";
    private static final String DB2_JDBC_DRIVER = "com.ibm.db2.jcc.DB2Driver";

    @Resource private IDatasourceService datasourceService;

    @PostMapping
    @ApiOperation(value = "create SLink datasource", notes = "create SLink datasource")
    public Result<String> createDatasource(@RequestBody DatasourceReq req) {
        return Result.success(
                datasourceService.createSlinkDatasource(
                        req.getDatasourceName(),
                        req.getPluginName(),
                        req.getPluginVersion(),
                        req.getDescription(),
                        parseDatasourceConfig(req)));
    }

    @PutMapping("/{id}")
    @ApiOperation(value = "update SLink datasource", notes = "update SLink datasource")
    public Result<Boolean> updateDatasource(
            @PathVariable("id") String id, @RequestBody DatasourceReq req) {
        return Result.success(
                datasourceService.updateSlinkDatasource(
                        Long.parseLong(id),
                        req.getDatasourceName(),
                        req.getPluginName(),
                        req.getPluginVersion(),
                        req.getDescription(),
                        parseDatasourceConfig(req)));
    }

    @DeleteMapping("/{id}")
    @ApiOperation(value = "delete SLink datasource", notes = "delete SLink datasource")
    public Result<Boolean> deleteDatasource(@PathVariable("id") String id) {
        return Result.success(datasourceService.deleteSlinkDatasource(Long.parseLong(id)));
    }

    @GetMapping("/{id}")
    @ApiOperation(value = "get SLink datasource detail", notes = "get SLink datasource detail")
    public Result<DatasourceDetailRes> getDatasource(@PathVariable("id") String id) {
        return Result.success(datasourceService.querySlinkDatasourceDetailById(id));
    }

    @GetMapping("/list")
    @ApiOperation(value = "get SLink datasource list", notes = "get SLink datasource list")
    public Result<PageInfo<DatasourceRes>> getDatasourceList(
            @RequestParam(value = "searchVal", required = false, defaultValue = "")
                    String searchVal,
            @RequestParam(value = "pluginName", required = false, defaultValue = "")
                    String pluginName,
            @RequestParam(value = "pageNo", required = false, defaultValue = "1") Integer pageNo,
            @RequestParam(value = "pageSize", required = false, defaultValue = "10")
                    Integer pageSize) {
        return Result.success(
                datasourceService.querySlinkDatasourceList(
                        searchVal, pluginName, pageNo, pageSize));
    }

    private Map<String, String> parseDatasourceConfig(DatasourceReq req) {
        if (req == null || StringUtils.isBlank(req.getDatasourceConfig())) {
            return new HashMap<>();
        }
        Map<String, String> datasourceConfig =
                JsonUtils.toMap(req.getDatasourceConfig(), String.class, String.class);
        applyDatasourceConfigDefaults(req.getPluginName(), datasourceConfig);
        return datasourceConfig;
    }

    private void applyDatasourceConfigDefaults(
            String pluginName, Map<String, String> datasourceConfig) {
        if (StringUtils.isBlank(pluginName)
                || datasourceConfig == null
                || datasourceConfig.isEmpty()) {
            return;
        }

        String url = buildJdbcUrl(pluginName, datasourceConfig);
        if (StringUtils.isNotBlank(url)) {
            datasourceConfig.putIfAbsent(URL_KEY, url);
        }

        String driver = defaultDriver(pluginName);
        if (StringUtils.isNotBlank(driver)) {
            datasourceConfig.putIfAbsent(DRIVER_KEY, driver);
        }

        if (StringUtils.equals(pluginName, JDBC_DM_PLUGIN_NAME)
                && StringUtils.isBlank(datasourceConfig.get(SCHEMA_KEY))
                && StringUtils.isNotBlank(datasourceConfig.get(DATABASE_KEY))) {
            datasourceConfig.put(SCHEMA_KEY, datasourceConfig.get(DATABASE_KEY));
        }
    }

    private String buildJdbcUrl(String pluginName, Map<String, String> datasourceConfig) {
        if (StringUtils.isNotBlank(datasourceConfig.get(URL_KEY))) {
            return null;
        }
        String host = StringUtils.trimToEmpty(datasourceConfig.get(HOST_KEY));
        String port = StringUtils.trimToEmpty(datasourceConfig.get(PORT_KEY));
        String database = StringUtils.trimToEmpty(datasourceConfig.get(DATABASE_KEY));
        if (StringUtils.isBlank(host) || StringUtils.isBlank(port)) {
            return null;
        }

        if (StringUtils.equals(pluginName, JDBC_MYSQL_PLUGIN_NAME)
                && StringUtils.isNotBlank(database)) {
            return String.format(
                    "jdbc:mysql://%s:%s/%s?useSSL=false&serverTimezone=UTC&useUnicode=true&characterEncoding=utf-8",
                    host, port, database);
        }
        if (StringUtils.equals(pluginName, JDBC_ORACLE_PLUGIN_NAME)
                && StringUtils.isNotBlank(database)) {
            return String.format("jdbc:oracle:thin:@%s:%s:%s", host, port, database);
        }
        if (StringUtils.equals(pluginName, JDBC_DM_PLUGIN_NAME)) {
            return String.format("jdbc:dm://%s:%s", host, port);
        }
        if (StringUtils.equals(pluginName, JDBC_POSTGRES_PLUGIN_NAME)
                && StringUtils.isNotBlank(database)) {
            return String.format(
                    "jdbc:postgresql://%s:%s/%s?useSSL=false&serverTimezone=UTC&useUnicode=true&characterEncoding=utf-8",
                    host, port, database);
        }
        if (StringUtils.equals(pluginName, JDBC_SQLSERVER_PLUGIN_NAME)
                && StringUtils.isNotBlank(database)) {
            return String.format("jdbc:sqlserver://%s:%s;database=%s", host, port, database);
        }
        if (StringUtils.equals(pluginName, JDBC_DB2_PLUGIN_NAME)
                && StringUtils.isNotBlank(database)) {
            return String.format("jdbc:db2://%s:%s/%s", host, port, database);
        }
        return null;
    }

    private String defaultDriver(String pluginName) {
        if (StringUtils.equals(pluginName, JDBC_MYSQL_PLUGIN_NAME)) {
            return MYSQL_JDBC_DRIVER;
        }
        if (StringUtils.equals(pluginName, JDBC_ORACLE_PLUGIN_NAME)) {
            return ORACLE_JDBC_DRIVER;
        }
        if (StringUtils.equals(pluginName, JDBC_DM_PLUGIN_NAME)) {
            return DM_JDBC_DRIVER;
        }
        if (StringUtils.equals(pluginName, JDBC_POSTGRES_PLUGIN_NAME)) {
            return POSTGRES_JDBC_DRIVER;
        }
        if (StringUtils.equals(pluginName, JDBC_SQLSERVER_PLUGIN_NAME)) {
            return SQLSERVER_JDBC_DRIVER;
        }
        if (StringUtils.equals(pluginName, JDBC_DB2_PLUGIN_NAME)) {
            return DB2_JDBC_DRIVER;
        }
        return null;
    }
}

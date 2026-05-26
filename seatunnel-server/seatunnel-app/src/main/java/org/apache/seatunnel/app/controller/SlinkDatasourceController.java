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
            @RequestParam(value = "pageNo", required = false, defaultValue = "1")
                    Integer pageNo,
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
        return JsonUtils.toMap(req.getDatasourceConfig(), String.class, String.class);
    }
}

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
import org.apache.seatunnel.app.domain.request.localfile.LocalFilePreviewReq;
import org.apache.seatunnel.app.domain.response.localfile.LocalFileEntryRes;
import org.apache.seatunnel.app.domain.response.localfile.LocalFilePreviewRes;
import org.apache.seatunnel.app.service.ILocalFileService;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.Resource;

import java.util.List;

@RestController
@RequestMapping("/seatunnel/api/v1/local-file")
public class LocalFileController {

    @Resource private ILocalFileService localFileService;

    @GetMapping("/roots")
    public Result<List<LocalFileEntryRes>> roots() {
        return Result.success(localFileService.roots());
    }

    @GetMapping("/list")
    public Result<List<LocalFileEntryRes>> list(@RequestParam("path") String path) {
        return Result.success(localFileService.list(path));
    }

    @PostMapping("/preview")
    public Result<LocalFilePreviewRes> preview(@RequestBody LocalFilePreviewReq req) {
        return Result.success(localFileService.preview(req));
    }
}

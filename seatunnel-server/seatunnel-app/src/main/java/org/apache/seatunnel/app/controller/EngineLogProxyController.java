/* @author: zhjj */
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

import org.apache.seatunnel.app.config.EngineProxyProperties;

import org.apache.commons.lang3.StringUtils;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import javax.annotation.Resource;
import javax.servlet.http.HttpServletRequest;

import java.nio.charset.StandardCharsets;
import java.util.Map;

@RestController
public class EngineLogProxyController {

    private static final String LOG_API_PREFIX = "/api/logs";

    @Resource private RestTemplate restTemplate;

    @Resource private EngineProxyProperties engineProxyProperties;

    @GetMapping({LOG_API_PREFIX, LOG_API_PREFIX + "/**"})
    public ResponseEntity<byte[]> proxyLogs(HttpServletRequest request) {
        String targetUrl = buildTargetUrl(request);
        HttpHeaders requestHeaders = new HttpHeaders();
        String acceptHeader = request.getHeader(HttpHeaders.ACCEPT);
        if (StringUtils.isNotBlank(acceptHeader)) {
            requestHeaders.set(HttpHeaders.ACCEPT, acceptHeader);
        }

        try {
            ResponseEntity<byte[]> response =
                    restTemplate.exchange(
                            targetUrl,
                            HttpMethod.GET,
                            new HttpEntity<>(requestHeaders),
                            byte[].class);
            return ResponseEntity.status(response.getStatusCode())
                    .headers(copyResponseHeaders(response.getHeaders()))
                    .body(response.getBody());
        } catch (HttpStatusCodeException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .headers(copyResponseHeaders(e.getResponseHeaders()))
                    .body(e.getResponseBodyAsByteArray());
        } catch (ResourceAccessException e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(
                            "Failed to reach SeaTunnel engine log endpoint."
                                    .getBytes(StandardCharsets.UTF_8));
        }
    }

    private String buildTargetUrl(HttpServletRequest request) {
        String requestUri = request.getRequestURI();
        String requestPath =
                StringUtils.removeStart(
                        requestUri,
                        StringUtils.defaultString(request.getContextPath()) + LOG_API_PREFIX);

        UriComponentsBuilder uriBuilder =
                UriComponentsBuilder.fromHttpUrl(engineProxyProperties.getBaseUrl())
                        .path("/logs")
                        .path(StringUtils.defaultString(requestPath));

        for (Map.Entry<String, String[]> parameter : request.getParameterMap().entrySet()) {
            for (String value : parameter.getValue()) {
                uriBuilder.queryParam(parameter.getKey(), value);
            }
        }
        return uriBuilder.build(true).toUriString();
    }

    private HttpHeaders copyResponseHeaders(HttpHeaders sourceHeaders) {
        HttpHeaders targetHeaders = new HttpHeaders();
        if (sourceHeaders == null) {
            return targetHeaders;
        }

        MediaType contentType = sourceHeaders.getContentType();
        if (contentType != null) {
            targetHeaders.setContentType(contentType);
        }

        long contentLength = sourceHeaders.getContentLength();
        if (contentLength >= 0) {
            targetHeaders.setContentLength(contentLength);
        }

        if (sourceHeaders.getCacheControl() != null) {
            targetHeaders.setCacheControl(sourceHeaders.getCacheControl());
        }

        if (sourceHeaders.getETag() != null) {
            targetHeaders.setETag(sourceHeaders.getETag());
        }

        if (sourceHeaders.getLastModified() > 0) {
            targetHeaders.setLastModified(sourceHeaders.getLastModified());
        }

        return targetHeaders;
    }
}

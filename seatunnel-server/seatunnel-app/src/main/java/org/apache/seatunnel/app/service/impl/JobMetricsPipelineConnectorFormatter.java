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

package org.apache.seatunnel.app.service.impl;

import org.apache.seatunnel.app.dal.entity.JobMetrics;
import org.apache.seatunnel.app.domain.response.metrics.Edge;
import org.apache.seatunnel.app.domain.response.metrics.JobDAG;
import org.apache.seatunnel.app.domain.response.metrics.VertexInfo;
import org.apache.seatunnel.common.constants.PluginType;

import org.apache.commons.lang3.StringUtils;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class JobMetricsPipelineConnectorFormatter {

    private JobMetricsPipelineConnectorFormatter() {}

    static void applyFallbackConnectorNames(JobDAG jobDAG, List<JobMetrics> jobMetricsList) {
        if (jobDAG == null || jobMetricsList == null || jobMetricsList.isEmpty()) {
            return;
        }

        Map<Integer, PipelineConnectorNames> connectorNamesByPipelineId =
                buildConnectorNamesByPipelineId(jobDAG);
        if (connectorNamesByPipelineId.isEmpty()) {
            return;
        }

        for (JobMetrics jobMetrics : jobMetricsList) {
            if (jobMetrics == null || jobMetrics.getPipelineId() == null) {
                continue;
            }

            PipelineConnectorNames connectorNames =
                    connectorNamesByPipelineId.get(jobMetrics.getPipelineId());
            if (connectorNames == null) {
                continue;
            }

            if (StringUtils.isBlank(jobMetrics.getSourceTableNames())) {
                jobMetrics.setSourceTableNames(connectorNames.sourceConnectorNames);
            }
            if (StringUtils.isBlank(jobMetrics.getSinkTableNames())) {
                jobMetrics.setSinkTableNames(connectorNames.sinkConnectorNames);
            }
        }
    }

    private static Map<Integer, PipelineConnectorNames> buildConnectorNamesByPipelineId(
            JobDAG jobDAG) {
        Map<Integer, PipelineConnectorNames> result = new LinkedHashMap<>();
        Map<Integer, List<Edge>> pipelineEdges = jobDAG.getPipelineEdges();
        Map<Integer, VertexInfo> vertexInfoMap = jobDAG.getVertexInfoMap();
        if (pipelineEdges == null || pipelineEdges.isEmpty() || vertexInfoMap == null) {
            return result;
        }

        for (Map.Entry<Integer, List<Edge>> pipelineEntry : pipelineEdges.entrySet()) {
            Set<String> sourceConnectorNames = new LinkedHashSet<>();
            Set<String> sinkConnectorNames = new LinkedHashSet<>();

            for (Edge edge : pipelineEntry.getValue()) {
                collectConnectorName(
                        sourceConnectorNames,
                        sinkConnectorNames,
                        vertexInfoMap,
                        edge.getInputVertexId());
                collectConnectorName(
                        sourceConnectorNames,
                        sinkConnectorNames,
                        vertexInfoMap,
                        edge.getTargetVertexId());
            }

            result.put(
                    pipelineEntry.getKey(),
                    new PipelineConnectorNames(
                            String.join(", ", sourceConnectorNames),
                            String.join(", ", sinkConnectorNames)));
        }
        return result;
    }

    private static void collectConnectorName(
            Set<String> sourceConnectorNames,
            Set<String> sinkConnectorNames,
            Map<Integer, VertexInfo> vertexInfoMap,
            Long vertexId) {
        if (vertexId == null) {
            return;
        }

        VertexInfo vertexInfo = vertexInfoMap.get(vertexId.intValue());
        if (vertexInfo == null) {
            return;
        }

        String connectorName = normalizeConnectorName(vertexInfo);
        if (StringUtils.isBlank(connectorName)) {
            return;
        }

        if (PluginType.SOURCE == vertexInfo.getType()) {
            sourceConnectorNames.add(connectorName);
        } else if (PluginType.SINK == vertexInfo.getType()) {
            sinkConnectorNames.add(connectorName);
        }
    }

    private static String normalizeConnectorName(VertexInfo vertexInfo) {
        if (vertexInfo == null) {
            return null;
        }
        if (StringUtils.isNotBlank(vertexInfo.getConnectorType())) {
            return vertexInfo.getConnectorType().trim();
        }
        return vertexInfo.getType() == null ? null : vertexInfo.getType().name();
    }

    private static final class PipelineConnectorNames {
        private final String sourceConnectorNames;
        private final String sinkConnectorNames;

        private PipelineConnectorNames(String sourceConnectorNames, String sinkConnectorNames) {
            this.sourceConnectorNames = sourceConnectorNames;
            this.sinkConnectorNames = sinkConnectorNames;
        }
    }
}

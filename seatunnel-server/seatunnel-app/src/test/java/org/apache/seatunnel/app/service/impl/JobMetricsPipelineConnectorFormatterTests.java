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

import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.LinkedHashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class JobMetricsPipelineConnectorFormatterTests {

    @Test
    public void
            testApplyFallbackConnectorNamesUsesDagConnectorTypesWithoutOverwritingExistingNames() {
        JobMetrics emptyMetric = new JobMetrics();
        emptyMetric.setPipelineId(7);

        JobMetrics existingMetric = new JobMetrics();
        existingMetric.setPipelineId(7);
        existingMetric.setSourceTableNames("custom-source");
        existingMetric.setSinkTableNames("custom-sink");

        JobMetricsPipelineConnectorFormatter.applyFallbackConnectorNames(
                buildJobDag(), Arrays.asList(emptyMetric, existingMetric));

        assertEquals("Http, Mysql", emptyMetric.getSourceTableNames());
        assertEquals("Doris", emptyMetric.getSinkTableNames());
        assertEquals("custom-source", existingMetric.getSourceTableNames());
        assertEquals("custom-sink", existingMetric.getSinkTableNames());
    }

    private JobDAG buildJobDag() {
        LinkedHashMap<Integer, java.util.List<Edge>> pipelineEdges = new LinkedHashMap<>();
        pipelineEdges.put(7, Arrays.asList(new Edge(1L, 3L), new Edge(2L, 3L), new Edge(3L, 4L)));

        LinkedHashMap<Integer, VertexInfo> vertexInfoMap = new LinkedHashMap<>();
        vertexInfoMap.put(1, new VertexInfo(1L, PluginType.SOURCE, "Http"));
        vertexInfoMap.put(2, new VertexInfo(2L, PluginType.SOURCE, "Mysql"));
        vertexInfoMap.put(3, new VertexInfo(3L, PluginType.TRANSFORM, "FieldMapper"));
        vertexInfoMap.put(4, new VertexInfo(4L, PluginType.SINK, "Doris"));

        return new JobDAG(1L, pipelineEdges, vertexInfoMap);
    }
}

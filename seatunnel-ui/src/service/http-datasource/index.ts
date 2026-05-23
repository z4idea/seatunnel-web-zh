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

import { axios } from '@/service/service'
import type {
  HttpDatasourcePreviewReq,
  HttpDatasourcePreviewRes
} from './types'

const HTTP_DATASOURCE_BASE_URL = '/http-datasource'

export function previewHttpDatasource(
  data: HttpDatasourcePreviewReq
): Promise<HttpDatasourcePreviewRes> {
  return axios({
    url: `${HTTP_DATASOURCE_BASE_URL}/preview`,
    method: 'post',
    data,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8'
    },
    transformRequest: (params) => JSON.stringify(params)
  })
}

export type {
  HttpDatasourcePreviewField,
  HttpDatasourcePreviewReq,
  HttpDatasourcePreviewRes
} from './types'

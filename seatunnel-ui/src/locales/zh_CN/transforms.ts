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

export default {
  common: {
    compatible_mode_value: '兼容模式',
    compatible_mode_placeholder:
      '数据库支持多种兼容模式时需要填写，例如 MySQL、Oracle 等。',
    debezium_related_configuration_parameters_value: 'Debezium 相关的配置参数',
    debezium_related_configuration_parameters_placeholder:
      '将 Debezium 参数透传给 DebeziumEmbeddedEngine，用于捕获数据库变更。可参考 Debezium MySQL Connector 文档填写，示例：{\n  \"snapshot.mode\": \"initial\"\n}',
    properties_value: '扩展参数',
    properties_placeholder: '请输入额外的连接配置参数',
    mysql_server_id_value: 'MySQL Server ID',
    mysql_server_id_placeholder:
      '请输入当前数据库客户端的数值 ID，或数值 ID 范围，例如 5400 或 5400-5408',
    server_id_value: 'Server ID',
    server_id_placeholder:
      '请输入当前数据库客户端的数值 ID，或数值 ID 范围，例如 5400 或 5400-5408',
    use_select_count_value: '是否使用 SELECT COUNT',
    skip_analyze_value: '是否跳过统计分析',
    table_path_value: '表路径',
    table_path_placeholder: '请输入完整表路径',
    where_condition_value: '过滤条件',
    where_condition_placeholder:
      '请输入通用行过滤条件，需以 where 开头，例如 where id > 100',
    table_list_value: '表列表',
    table_list_placeholder: '请输入表列表配置',
    table_transform_value: '表转换配置',
    table_transform_placeholder: '请输入表转换规则配置',
    table_match_regex_value: '表匹配正则',
    table_match_regex_placeholder: '请输入表匹配正则，默认使用 .* 匹配全部表',
    split_size_value: '分片大小',
    split_even_distribution_factor_upper_bound_value: '分片均匀分布因子上限',
    split_even_distribution_factor_lower_bound_value: '分片均匀分布因子下限',
    split_sample_sharding_threshold_value: '分片采样阈值',
    split_inverse_sampling_rate_value: '反向采样率',
    chunk_key_even_distribution_factor_lower_bound_value:
      'Chunk Key 均匀分布因子下限',
    chunk_key_even_distribution_factor_upper_bound_value:
      'Chunk Key 均匀分布因子上限',
    sample_sharding_threshold_value: '采样分片阈值',
    inverse_sampling_rate_value: '反向采样率',
    table_names_config_value: '表配置列表',
    table_names_config_placeholder:
      '请输入表配置列表，例如：[{\"table\":\"db1.schema1.table1\",\"primaryKeys\":[\"key1\",\"key2\"],\"snapshotSplitColumn\":\"key2\"}]',
    schema_changes_enabled_value: '是否同步 Schema 变更',
    exactly_once_value: '是否开启 Exactly Once',
    parallelism_value: '并行度',
    dialect_value: '方言',
    dialect_placeholder: '如未指定，将根据连接地址自动识别数据库方言',
    schema_save_mode_value: 'Schema 保存模式',
    data_save_mode_value: '数据保存模式',
    create_index_value: '是否创建索引',
    multi_table_sink_replica_value: '多表写入副本数',
    option_true: '是',
    option_false: '否',
    option_CREATE_SCHEMA_WHEN_NOT_EXIST: '不存在时创建 Schema',
    option_APPEND_DATA: '追加数据',
    option_FAIL: '失败',
    option_SKIP: '跳过'
  },
  fieldmapper: {
    source_field_name_value: '源字段',
    source_field_name_placeholder: '请选择源字段',
    target_field_name_value: '目标字段',
    target_field_name_placeholder: '请输入目标字段名称'
  },
  filterrowkind: {
    kinds_value: '记录类型',
    kinds_placeholder: '请选择需要保留的记录类型'
  },
  multifieldsplit: {
    source_field_name_value: '源字段',
    source_field_name_placeholder: '请选择需要拆分的字段',
    delimiter_value: '分隔符',
    delimiter_placeholder: '请输入拆分分隔符',
    split_field_names_value: '拆分字段',
    split_field_names_placeholder: '请输入拆分后的字段名'
  },
  copy: {
    source_field_name_value: '源字段',
    source_field_name_placeholder: '请选择需要复制的字段',
    target_field_name_value: '目标字段',
    target_field_name_placeholder: '请输入复制后的字段名称'
  },
  sql: {
    query_value: 'SQL 语句',
    query_placeholder: '请输入用于转换数据的 SQL 语句'
  },
  replace: {
    replace_field_value: '需要替换的字段',
    replace_field_placeholder: '请输入要替换的字段',
    pattern_value: '将被替换的旧字符串',
    pattern_placeholder: '请输入要被替换的旧字符串',
    replacement_value: '用于替换的新字符串',
    replacement_placeholder: '请输入用于替换的新字符串',
    is_regex_value: '是否使用正则匹配'
  },
  jsonpath: {
    columns_value: '解析字段',
    columns_placeholder: '需要解析的字段数组',
    row_error_handle_way_value: '列发生错误时的处理方式',
    row_error_handle_way_placeholder: '请选择解析失败时的处理方式'
  }
}

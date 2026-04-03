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
    compatible_mode_value: 'Compatible Mode',
    compatible_mode_placeholder:
      'Required when the database supports multiple compatible modes, such as MySQL or Oracle.',
    debezium_related_configuration_parameters_value:
      'Debezium Related Configuration Parameters',
    debezium_related_configuration_parameters_placeholder:
      'Pass Debezium parameters to DebeziumEmbeddedEngine for capturing database changes. Refer to the Debezium MySQL Connector documentation. Example: {\n  \"snapshot.mode\": \"initial\"\n}',
    properties_value: 'Properties',
    properties_placeholder: 'Please enter additional connection properties',
    mysql_server_id_value: 'MySQL Server ID',
    mysql_server_id_placeholder:
      'Enter a numeric ID or numeric ID range for this database client, for example 5400 or 5400-5408',
    server_id_value: 'Server ID',
    server_id_placeholder:
      'Enter a numeric ID or numeric ID range for this database client, for example 5400 or 5400-5408',
    use_select_count_value: 'Use SELECT COUNT',
    skip_analyze_value: 'Skip Analyze',
    table_path_value: 'Table Path',
    table_path_placeholder: 'Please enter the full table path',
    where_condition_value: 'Where Condition',
    where_condition_placeholder:
      'Enter a common row filter condition starting with where, for example where id > 100',
    table_list_value: 'Table List',
    table_list_placeholder: 'Please enter the table list configuration',
    table_transform_value: 'Table Transform',
    table_transform_placeholder: 'Please enter the table transform configuration',
    table_match_regex_value: 'Table Match Regex',
    table_match_regex_placeholder:
      'Please enter the table match regex, default .* matches all tables',
    split_size_value: 'Split Size',
    split_even_distribution_factor_upper_bound_value:
      'Split Even Distribution Factor Upper Bound',
    split_even_distribution_factor_lower_bound_value:
      'Split Even Distribution Factor Lower Bound',
    split_sample_sharding_threshold_value: 'Split Sample Sharding Threshold',
    split_inverse_sampling_rate_value: 'Split Inverse Sampling Rate',
    chunk_key_even_distribution_factor_lower_bound_value:
      'Chunk Key Even Distribution Factor Lower Bound',
    chunk_key_even_distribution_factor_upper_bound_value:
      'Chunk Key Even Distribution Factor Upper Bound',
    sample_sharding_threshold_value: 'Sample Sharding Threshold',
    inverse_sampling_rate_value: 'Inverse Sampling Rate',
    table_names_config_value: 'Table Names Config',
    table_names_config_placeholder:
      'Enter table configs, for example: [{\"table\":\"db1.schema1.table1\",\"primaryKeys\":[\"key1\",\"key2\"],\"snapshotSplitColumn\":\"key2\"}]',
    schema_changes_enabled_value: 'Schema Changes Enabled',
    exactly_once_value: 'Exactly Once',
    parallelism_value: 'Parallelism',
    dialect_value: 'Dialect',
    dialect_placeholder:
      'If not specified, the database dialect will be inferred from the connection URL',
    schema_save_mode_value: 'Schema Save Mode',
    data_save_mode_value: 'Data Save Mode',
    create_index_value: 'Create Index',
    multi_table_sink_replica_value: 'Multi-table Sink Replica',
    option_true: 'True',
    option_false: 'False',
    option_CREATE_SCHEMA_WHEN_NOT_EXIST: 'Create Schema When Not Exist',
    option_APPEND_DATA: 'Append Data',
    option_FAIL: 'Fail',
    option_SKIP: 'Skip'
  },
  fieldmapper: {
    source_field_name_value: 'Source Field',
    source_field_name_placeholder: 'Please select the source field',
    target_field_name_value: 'Target Field',
    target_field_name_placeholder: 'Please enter the target field name'
  },
  filterrowkind: {
    kinds_value: 'Row Kinds',
    kinds_placeholder: 'Please select row kinds to keep'
  },
  multifieldsplit: {
    source_field_name_value: 'Source Field',
    source_field_name_placeholder: 'Please select the field to split',
    delimiter_value: 'Delimiter',
    delimiter_placeholder: 'Please enter the split delimiter',
    split_field_names_value: 'Split Fields',
    split_field_names_placeholder: 'Please enter split field names'
  },
  copy: {
    source_field_name_value: 'Source Field',
    source_field_name_placeholder: 'Please select the field to copy',
    target_field_name_value: 'Target Field',
    target_field_name_placeholder: 'Please enter the copied field name'
  },
  sql: {
    query_value: 'SQL Statement',
    query_placeholder: 'Please enter the SQL statement for transformation'
  },
  replace: {
    replace_field_value: 'Replace Field',
    replace_field_placeholder: 'Please enter the field to be replaced',
    pattern_value: 'Pattern',
    pattern_placeholder: 'Please enter the old string to be replaced',
    replacement_value: 'Replacement',
    replacement_placeholder: 'Please enter a new string for replacement',
    is_regex_value: 'Is Regex'
  },
  jsonpath: {
    columns_value: 'Columns',
    columns_placeholder: 'Field array that needs to be parsed',
    row_error_handle_way_value: 'Row Error Handle Way',
    row_error_handle_way_placeholder: 'Please select how to handle parse errors'
  }
}

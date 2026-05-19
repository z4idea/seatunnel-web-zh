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

package org.apache.seatunnel.app.utils;

import org.apache.seatunnel.app.common.JdbcIncrementalColumnType;

import org.apache.commons.lang3.StringUtils;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;

public final class JobIncrementalUtils {

    private JobIncrementalUtils() {}

    public static String buildWhereCondition(
            String staticWhereCondition,
            String quotedColumn,
            String lowerBound,
            String upperBound,
            JdbcIncrementalColumnType columnType) {
        String dynamicPredicate;
        if (StringUtils.isBlank(upperBound)) {
            dynamicPredicate = "1 = 0";
        } else if (StringUtils.isBlank(lowerBound)) {
            dynamicPredicate = quotedColumn + " <= " + toSqlLiteral(upperBound, columnType);
        } else {
            dynamicPredicate =
                    quotedColumn
                            + " > "
                            + toSqlLiteral(lowerBound, columnType)
                            + " AND "
                            + quotedColumn
                            + " <= "
                            + toSqlLiteral(upperBound, columnType);
        }
        return mergeWhereCondition(staticWhereCondition, dynamicPredicate);
    }

    public static String mergeWhereCondition(String staticWhereCondition, String dynamicPredicate) {
        if (StringUtils.isBlank(staticWhereCondition)) {
            return "WHERE " + dynamicPredicate;
        }
        String normalized = stripLeadingWhere(staticWhereCondition).trim();
        if (normalized.isEmpty()) {
            return "WHERE " + dynamicPredicate;
        }
        return "WHERE (" + normalized + ") AND (" + dynamicPredicate + ")";
    }

    public static String stripLeadingWhere(String whereCondition) {
        String normalized = StringUtils.trimToEmpty(whereCondition);
        if (normalized.length() >= 5 && normalized.substring(0, 5).equalsIgnoreCase("where")) {
            return normalized.substring(5).trim();
        }
        return normalized;
    }

    public static String toStoredValue(Object value, JdbcIncrementalColumnType columnType) {
        if (value == null) {
            return null;
        }
        switch (columnType) {
            case NUMBER:
                return new BigDecimal(value.toString().trim()).stripTrailingZeros().toPlainString();
            case DATE:
                if (value instanceof java.sql.Date) {
                    return value.toString();
                }
                if (value instanceof LocalDate) {
                    return value.toString();
                }
                return value.toString().trim();
            case DATETIME:
            case TIMESTAMP:
                if (value instanceof Timestamp) {
                    return value.toString();
                }
                if (value instanceof LocalDateTime) {
                    return value.toString().replace('T', ' ');
                }
                if (value instanceof java.util.Date) {
                    return new Timestamp(((java.util.Date) value).getTime()).toString();
                }
                return value.toString().trim().replace('T', ' ');
            default:
                throw new IllegalArgumentException(
                        "Unsupported incremental column type: " + columnType);
        }
    }

    public static boolean shouldAdvance(
            String currentValue, String candidateValue, JdbcIncrementalColumnType columnType) {
        if (StringUtils.isBlank(candidateValue)) {
            return false;
        }
        if (StringUtils.isBlank(currentValue)) {
            return true;
        }
        return compare(currentValue, candidateValue, columnType) < 0;
    }

    public static String toSqlLiteral(String value, JdbcIncrementalColumnType columnType) {
        if (columnType == JdbcIncrementalColumnType.NUMBER) {
            return value;
        }
        return "'" + value.replace("'", "''") + "'";
    }

    private static int compare(
            String currentValue, String candidateValue, JdbcIncrementalColumnType columnType) {
        switch (columnType) {
            case NUMBER:
                return new BigDecimal(currentValue).compareTo(new BigDecimal(candidateValue));
            case DATE:
                return LocalDate.parse(currentValue).compareTo(LocalDate.parse(candidateValue));
            case DATETIME:
            case TIMESTAMP:
                return Timestamp.valueOf(normalizeTimestamp(currentValue))
                        .compareTo(Timestamp.valueOf(normalizeTimestamp(candidateValue)));
            default:
                throw new IllegalArgumentException(
                        "Unsupported incremental column type: " + columnType);
        }
    }

    private static String normalizeTimestamp(String value) {
        return value.trim().replace('T', ' ');
    }
}

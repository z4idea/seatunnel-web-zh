# SeaTunnel Web 项目整体架构说明

## 一、项目是做什么的

这个项目本质上是 Apache SeaTunnel 的一套 Web 管理与编排平台。

它主要解决下面几类问题：

- 统一管理数据源
- 通过 Web 页面创建数据集成 / 数据同步任务
- 把页面上的任务配置转换成真正可执行的 SeaTunnel 作业配置
- 提交作业到执行引擎
- 在页面上查看任务实例、日志、状态和指标

可以简单理解为：

- `seatunnel-ui` 负责前端页面
- `seatunnel-server` 负责后端业务逻辑
- `seatunnel-datasource` 负责数据源插件和元数据访问
- 最终输出是一份可以给 SeaTunnel 执行引擎运行的 `conf`

## 二、项目核心模块

### 1. `seatunnel-ui`

前端工程。

主要职责：

- 数据源管理页面
- 同步任务编排页面
- source / transform / sink 配置页面
- 任务实例状态、日志、指标展示

### 2. `seatunnel-server`

后端核心服务。

主要职责：

- 提供 REST API
- 保存数据源、任务、版本、连线、实例等元数据
- 把页面模型转换成 SeaTunnel 配置
- 提交任务并跟踪任务执行状态

重点子模块：

- `seatunnel-app`：主要业务逻辑都在这里
- `seatunnel-dynamicform`：动态表单、规则生成
- `seatunnel-server-common`：服务端公共能力

### 3. `seatunnel-datasource`

数据源抽象层。

主要职责：

- 数据源插件发现与加载
- 数据源连通性测试
- 查询数据库 / schema / 表 / 字段
- 向 Web 返回元数据

重点结构：

- `seatunnel-datasource-client`：负责 classloader 和数据源插件加载
- `seatunnel-datasource-plugins`：实际的数据源插件实现，例如 MySQL、Oracle、DM、DB2

### 4. `seatunnel-web-dist`

打包分发模块。

主要职责：

- 组装前端、后端、插件产物
- 输出可运行的整体发行包

### 5. `seatunnel-web-it`

集成测试模块。

主要职责：

- 验证 Web 流程和后端接口行为

## 三、整体业务流程

项目的主流程可以概括成下面几步：

1. 创建数据源
2. 测试数据源连通性
3. 查询数据库、表、字段元数据
4. 在 Web 页面创建同步任务
5. 配置 source / transform / sink
6. 后端把页面配置转换成 SeaTunnel 作业配置
7. 提交到执行引擎运行
8. 在页面查看执行状态、日志、指标

## 四、核心运行链路

### 1. 数据源创建与元数据查询

当页面需要获取数据源元数据时，整体链路大致是：

- 前端调用 `seatunnel-app` 中的数据源相关接口
- 后端根据数据源名称找到对应的数据源插件
- 通过自定义 classloader 加载对应插件 jar
- 调用插件中的元数据方法
- 返回数据库、表、字段等信息给前端

常见的方法包括：

- `getDatabases`
- `getTables`
- `getTableFields`
- `checkDataSourceConnectivity`

例如达梦数据源的元数据实现就在：

- [DMDataSourceChannel.java](/D:/Idea/seatunnel-web-zh/seatunnel-datasource/seatunnel-datasource-plugins/datasource-jdbc-dm/src/main/java/org/apache/seatunnel/datasource/plugin/dm/jdbc/DMDataSourceChannel.java)

### 2. 字段类型转换

表字段查出来之后，Web 还需要判断这些字段是否能被 SeaTunnel 正常识别。

这一步主要由下面这个类处理：

- [TableSchemaServiceImpl.java](/D:/Idea/seatunnel-web-zh/seatunnel-server/seatunnel-app/src/main/java/org/apache/seatunnel/app/service/impl/TableSchemaServiceImpl.java)

它的逻辑是：

- 先对插件名做规范化
- 优先查找数据库专用的 `DataTypeConvertor`
- 如果找不到，就退回到通用的 `EngineDataType.SeaTunnelDataTypeConvertor`

这一步决定了：

- 字段类型是否支持
- 数据库字段类型如何映射成 SeaTunnel 类型

### 3. 页面任务模型转 SeaTunnel Connector 配置

用户在页面上配置 source / sink / transform 之后，后端并不会直接执行这些页面参数，而是先把它们转换成 SeaTunnel Connector 需要的配置结构。

关键类包括：

- [JobTaskServiceImpl.java](/D:/Idea/seatunnel-web-zh/seatunnel-server/seatunnel-app/src/main/java/org/apache/seatunnel/app/service/impl/JobTaskServiceImpl.java)
- [JobInstanceServiceImpl.java](/D:/Idea/seatunnel-web-zh/seatunnel-server/seatunnel-app/src/main/java/org/apache/seatunnel/app/service/impl/JobInstanceServiceImpl.java)
- `seatunnel-app/.../thirdparty/datasource/impl` 目录下的各类 `DataSourceConfigSwitcher`

这里的 `DataSourceConfigSwitcher` 很关键，它负责：

- 把数据源实例配置和任务配置合并
- source 侧生成查询 SQL
- sink 侧注入 `database`、`table`
- 处理不同数据库的特殊行为

例如达梦的 Web 侧适配逻辑在：

- [DMDataSourceConfigSwitcher.java](/D:/Idea/seatunnel-web-zh/seatunnel-server/seatunnel-app/src/main/java/org/apache/seatunnel/app/thirdparty/datasource/impl/DMDataSourceConfigSwitcher.java)

### 4. 最终作业配置生成

后端最终会组装四部分配置：

- `env`
- `source`
- `transform`
- `sink`

然后拼出完整的 SeaTunnel job config。

这份 config 才是最终交给 SeaTunnel 执行引擎运行的内容。

### 5. 作业执行与监控

任务提交以后：

- 后端会创建任务实例记录
- 执行引擎开始运行生成出来的 SeaTunnel 配置
- 后端定时更新任务状态和运行指标
- 页面展示执行状态、日志、吞吐、读写条数等信息

## 五、项目里的几个关键扩展点

### 1. 数据源插件扩展点

位置：

- `seatunnel-datasource/seatunnel-datasource-plugins`

用于扩展：

- 连通性测试
- 元数据查询
- 数据源参数定义

### 2. Web 数据源切换器扩展点

位置：

- `seatunnel-server/seatunnel-app/.../thirdparty/datasource/impl`

用于扩展：

- 页面数据源配置如何转成 SeaTunnel Connector 配置
- 查询 SQL 如何生成
- sink 额外参数如何注入

### 3. 数据源与 Connector 的映射配置

位置：

- [connector-datasource-mapper.yaml](/D:/Idea/seatunnel-web-zh/seatunnel-server/seatunnel-app/src/main/resources/connector-datasource-mapper.yaml)

用于控制：

- 数据源名称映射到哪个 connector
- 哪些数据源可以作为 source / sink
- 数据集成页面能否看到这个数据源

### 4. 类型转换扩展点

用于处理：

- 数据库字段类型到 SeaTunnel 类型的映射

实现来源可能有两种：

- SeaTunnel 已有的数据库专用 `DataTypeConvertor`
- 本项目里的通用兜底转换器

## 六、典型 JDBC 数据库接入路径

一个 JDBC 类数据库要完整接入到这个项目，通常要经过下面这条链路：

1. 在 `seatunnel-datasource-plugins` 中新增数据源插件
2. 在 datasource client 中注册插件加载信息
3. 在 Web 映射配置里把这个数据源暴露出来
4. 新增一个 `DataSourceConfigSwitcher`
5. 保证数据库、表、字段元数据查询正确
6. 保证字段类型转换正确
7. 保证生成出来的 SeaTunnel source / sink 配置正确
8. 打包、重启、做端到端验证

## 七、开发和验证方式

常见验证动作包括：

- 编译单个插件模块
- 编译 `seatunnel-app`
- 重新打包分发产物
- 重启服务
- 从页面完整走一遍流程验证

这个仓库里，如果改到了插件模块或者运行时逻辑，实际推荐流程是：

```powershell
.\build.cmd code
```

然后重启应用，再从 Web 页面重新验证。

## 八、实践中的几点经验

- 元数据查成功，不代表任务执行一定成功。元数据、类型转换、配置转换、运行时执行是四个不同层次。
- 数据源能创建成功，不代表它一定能出现在“数据集成”的 source / sink 选择框中。
- 数据库的引号规则、`schema.table` 规则、字段大小写规则，经常都需要单独处理。
- JDBC 数据库虽然看起来很像，但不能简单当成同一种库处理。达梦和 Oracle 有相似点，但并不完全相同。


# 新增一个数据库集成到 SeaTunnel Web 的完整流程

## 一、文档目标

这份文档说明：如果要把一个新的数据库接入到当前这个 SeaTunnel Web 项目里，需要做哪些事情、应该按什么顺序做、有哪些常见坑。

目标不是只做到“能创建数据源”，而是做到：

- 能创建数据源
- 能测试连通性
- 能查数据库 / 表 / 字段
- 能在 Web 的数据集成页面里被选中
- 能生成正确的 SeaTunnel 配置
- 能真实执行 source -> sink 任务

## 二、整体步骤总览

新增一个数据库，通常要覆盖下面这几层：

1. 数据源插件层
2. 数据源客户端加载层
3. Web 数据源映射层
4. Web 配置转换层
5. 字段类型转换层
6. 打包部署层
7. 端到端验证层

如果其中某一层没补齐，功能经常会表现成“看起来已经接入了，但真正跑不通”。

## 三、第一步：新增数据源插件

位置：

- `seatunnel-datasource/seatunnel-datasource-plugins`

一般做法是参考现有 JDBC 插件新建一个模块，例如：

- `datasource-jdbc-mysql`
- `datasource-jdbc-oracle`
- `datasource-jdbc-dm`

一个完整的数据源插件通常至少要有这些类：

- `*DataSourceConfig`
- `*OptionRule`
- `*JdbcDataSourceFactory`
- `*DataSourceChannel`

主要职责：

- 定义插件名称
- 定义数据源参数规则
- 测试连通性
- 查询数据库、表、字段元数据

核心方法一般包括：

- `getDatabases`
- `getTables`
- `getTableFields`
- `checkDataSourceConnectivity`

## 四、第二步：保证驱动在运行时真的可见

这一步非常容易踩坑。

不要默认认为只要 Maven 依赖加上了，运行时就一定能找到驱动。

如果数据源插件是通过自定义 classloader 单独加载的，那么 JDBC 驱动往往必须满足下面至少一种条件：

- 被正确打进插件产物
- 或者运行时 classloader 能明确加载到它

实际经验：

- 如果驱动类找不到，先检查插件 jar 内容
- 如果驱动类能找到但资源类找不到，也要检查 jar 打包方式

常见报错现象：

- `ClassNotFoundException`
- 驱动类找不到
- 驱动中的资源文件找不到
- 连通性测试在真正连库之前就失败

## 五、第三步：在 datasource client 中注册插件

只新增插件模块还不够，还要让 datasource client 能认出它。

你需要检查并补充：

- 数据源名称到工厂类的映射
- 插件 jar 名称到 classloader 的映射

否则即使插件代码存在，Web 后端也无法真正加载它。

## 六、第四步：把元数据能力做完整

这一层决定了 Web 页面能不能把数据库、表、字段正常展示出来。

页面依赖的数据通常包括：

- 数据库列表
- 表列表
- 字段列表
- 字段类型
- 主键信息
- 注释
- 是否可空

对于 JDBC 数据库来说，有时 `DatabaseMetaData` 足够，有时不够。

很多数据库最终还是要通过系统表或者 catalog SQL 才能拿到准确结果。

实际建议：

- 如果 JDBC 通用元数据不准，优先查数据库自己的系统表
- 保证字段顺序正确
- 保证主键信息准确
- 返回数据库真实类型名，不要随意猜测
- 如果后面类型转换依赖精度和小数位，要把 precision / scale 一起带出来

例如达梦这次接入时，字段元数据最终是通过系统表查询来增强的，而不是只依赖通用 JDBC metadata。

## 七、第五步：让 Web 数据集成页面能看到这个数据源

很多时候，数据源“能创建成功”和“能在数据集成页面被选择”不是一回事。

你还需要改 Web 侧的映射配置。

关键文件：

- [connector-datasource-mapper.yaml](/D:/Idea/seatunnel-web-zh/seatunnel-server/seatunnel-app/src/main/resources/connector-datasource-mapper.yaml)

这里需要确认几件事：

- 数据源名称映射到了哪个 connector
- 是否声明了它支持作为 source
- 是否声明了它支持作为 sink
- 是否支持对应的 scene mode

如果这一步没做，常见表现是：

- 数据源已经创建成功
- 连通性也没问题
- 但是在“创建同步任务 -> 数据集成”里选不到它

## 八、第六步：新增 Web 侧的 `DataSourceConfigSwitcher`

位置：

- `seatunnel-server/seatunnel-app/.../thirdparty/datasource/impl`

这一步负责把：

- 数据源实例配置
- 用户在页面选择的 database / table / fields

转换成：

- SeaTunnel connector 真正需要的配置

这是数据库接入里非常关键的一层。

常见职责包括：

- source 侧生成查询 SQL
- sink 侧设置 `database` 和 `table`
- 处理 `schema.table` 格式
- 处理数据库标识符引号规则
- 注入数据库特有的兼容参数

通常需要关注的方法：

- `getDataSourceName()`
- `tableFieldsToSql(...)`
- `quoteIdentifier(...)`
- 必要时重写 `mergeDatasourceConfig(...)`

例如：

- MySQL 一般用反引号
- 达梦一般用双引号
- 有些数据库要求表名必须是 `schema.table`
- 有些数据库需要额外注入大小写规则

## 九、第七步：处理字段类型转换

这一步和元数据查询不是同一层。

即使 `getTableFields()` 已经成功，Web 页面仍然可能因为字段类型映射失败而不能正常继续。

入口类：

- [TableSchemaServiceImpl.java](/D:/Idea/seatunnel-web-zh/seatunnel-server/seatunnel-app/src/main/java/org/apache/seatunnel/app/service/impl/TableSchemaServiceImpl.java)

它的处理逻辑是：

1. 优先找数据库专用 `DataTypeConvertor`
2. 找不到才走通用兜底转换器

建议：

- 如果 SeaTunnel 已经有该数据库的专用 `DataTypeConvertor`，优先复用
  - 如果没有的话需要自己在 connector-jdbc 的 catelog 里面添加（源码）

- 如果已有专用 convertor，一定要保证 Web 侧传入的插件标识和它的 identity 对得上
- 通用兜底只能作为过渡，不建议长期依赖

常见现象：

- 字段已经能查出来
- 但页面提示字段类型不支持
- 日志里有类型转换异常

## 十、第八步：处理字段名大小写和标识符问题

这是 JDBC 类数据库最容易在运行阶段出错的一类问题。

典型场景：

- 源端字段名是小写，比如 `id`
- 目标端真实列名是大写，比如 `ID`
- 页面配置看起来没问题
- 但执行时插入 SQL 报列不存在

可选处理方案：

- 使用 connector 自带的字段大小写参数，例如 `field_ide`
- 在 `DataSourceConfigSwitcher` 里为目标库注入字段大小写规则
- 必要时增加显式字段映射 transform

不要默认所有数据库都和 MySQL 一样宽松。

很多数据库对未加引号的标识符会自动折叠成大写，这一点一定要明确。

## 十一、第九步：验证真正的 source / sink 执行链路

一个数据库接入完成，不能只验证下面这些：

- 数据源能创建
- 连通性能测试成功
- 数据库、表、字段能查出来

还必须继续验证：

- source 配置生成是否正确
- sink 配置生成是否正确
- 任务能否提交
- 运行时 SQL 能否正确执行
- 建表逻辑是否正常
- 数据能否真实写入

只有真实跑通一条 source -> sink 链路，这个数据库接入才算完整。

## 十二、第十步：重新打包并重启

只在本地 compile 成功，不代表运行中的 Web 服务已经使用了新逻辑。

如果改到了插件模块、配置转换逻辑、类型转换逻辑，必须重新打包并重启服务。

这个仓库里，实际推荐流程是：

```powershell
.\build.cmd code
```

然后重启应用，再从页面重新验证。

如果只 compile 不重启，日志里很可能还是旧逻辑，容易误判。

## 十三、推荐验证顺序

建议按下面顺序验证：

1. 创建数据源
2. 测试连通性
3. 查询数据库
4. 查询表
5. 查询字段
6. 在 Web 数据集成里选择这个数据源作为 source
7. 在 Web 数据集成里选择这个数据源作为 sink
8. 生成并检查最终 conf
9. 执行任务
10. 检查日志、指标和目标表结果

## 十四、常见问题与注意事项

### 1. 驱动依赖在运行时不可见

现象：

- 插件初始化失败
- 驱动类找不到

原因：

- 驱动没有被正确打包
- classloader 看不到驱动

### 2. 数据源能创建，但数据集成页面选不到

现象：

- 数据源管理页面一切正常
- 但 source / sink 下拉框里没有这个数据源

原因：

- `connector-datasource-mapper.yaml` 没配置好

### 3. 表字段能查出来，但类型不支持

现象：

- `getTableFields()` 成功
- 页面仍提示字段不支持

原因：

- 没有专用 `DataTypeConvertor`
- 或者 convertor identity 对不上

### 4. 明明有专用 convertor，但还是走了通用兜底

现象：

- 日志里显示走了 fallback convertor

原因：

- `normalizePluginNameForConvertor()` 处理后的名字和 convertor 的 `getIdentity()` 不一致

### 5. SQL 引号规则不对

现象：

- source 查询 SQL 语法错误
- 表名、字段名找不到

原因：

- 不同数据库的标识符引号规则不同，没有单独处理

### 6. 字段大小写不一致导致运行失败

现象：

- source 字段和 sink 字段看起来只是大小写不同
- 运行时仍然报目标列不存在

原因：

- 目标库标识符大小写规则没有兼容

## 十五、推荐开发策略

建议按下面的顺序推进新数据库接入：

1. 先打通数据源连通性
2. 再把数据库 / 表 / 字段元数据做准确
3. 再让它出现在 Web 的数据集成页面
4. 再把字段类型转换补齐
5. 再把 source / sink 配置生成逻辑补齐
6. 最后跑真实任务验证

这个顺序很重要，因为很多后面的运行时问题，必须在前面的元数据和配置层都正常后才能准确定位。

## 十六、实践经验总结

结合实际接入过程，有几条经验非常重要：

- 元数据正确，不等于运行时一定正确
- JDBC 数据库长得像，不等于行为完全一样
- 不要简单把一种数据库强行当成另一种数据库处理，除非你已经验证过它们的元数据和类型行为完全兼容
- 如果 SeaTunnel 已经内置该数据库的专用类型转换器，优先复用，不要重复造轮子
- 如果数据库需要特殊 sink 行为，通常应该在 Web 侧的 `DataSourceConfigSwitcher` 中处理


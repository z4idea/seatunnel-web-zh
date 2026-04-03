# SeaTunnel UI 前端结构与整体逻辑说明

## 一、seatunnel-ui 是做什么的

`seatunnel-ui` 是 SeaTunnel Web 的前端控制台，主要承载以下能力：

- 登录与工作空间选择
- 数据源管理
- 同步任务定义管理
- 同步任务 DAG 编排
- 同步任务实例监控、日志查看、指标展示
- 用户管理
- 虚拟表管理
- 基础设置，如主题、语言等

它本质上是一个面向 SeaTunnel Web 后端的管理界面，前端负责：

- 组织页面和交互流程
- 调用后端 REST API
- 承接动态表单结构并渲染配置页面
- 提供 DAG 画布编排能力
- 展示作业执行状态、日志和指标

真正的任务配置转换、元数据持久化、任务提交和运行状态跟踪仍然由后端完成。

## 二、技术栈

从 `package.json`、`vite.config.ts` 和源码结构看，当前前端技术栈如下：

- `Vue 3`
- `Vite`
- `TypeScript`
- `Pinia`
- `Vue Router`
- `Naive UI`
- `Vue I18n`
- `Axios`
- `@antv/x6`

其中最关键的两类技术点是：

- 普通后台页面由 `Vue 3 + Naive UI` 实现
- 同步任务编排页的 DAG 画布由 `@antv/x6` 实现

## 三、目录结构

`src` 目录下的主要结构如下：

- `assets`
  - 静态资源、全局样式
- `common`
  - 通用常量或枚举
- `components`
  - 通用组件，如动态表单、日志弹窗、列选择器等
- `directives`
  - 自定义指令
- `hooks`
  - 通用 hooks
- `layouts`
  - 后台布局壳，目前主要是 `dashboard`
- `locales`
  - 国际化
- `router`
  - 路由拆分
- `service`
  - API 请求封装
- `store`
  - Pinia 状态管理
- `themes`
  - 主题配置
- `utils`
  - 工具函数
- `views`
  - 页面级模块

页面模块主要分布在：

- `views/login`
- `views/setting`
- `views/datasource`
- `views/task`
- `views/user-manage`
- `views/virtual-tables`

## 四、应用启动链路

前端启动入口在 `src/main.ts`：

1. 创建 Vue 应用
2. 创建 Pinia
3. 启用 `pinia-plugin-persistedstate`
4. 挂载 `router`
5. 挂载 `i18n`
6. 挂载全局样式
7. 启动应用

`src/App.tsx` 负责全局应用壳：

- 注入 `Naive UI` 的 `NConfigProvider`
- 根据主题 store 切换明暗主题
- 根据设置 store 切换中英文和日期语言
- 提供全局消息和对话框上下文
- 最终渲染 `router-view`

所以应用级状态主要体现在：

- 主题
- 语言
- Naive UI 全局配置

## 五、路由组织方式

路由集中在 `src/router`：

- `index.ts`
- `routes.ts`
- `tasks.ts`
- `datasource.ts`
- `virtual-tables.ts`
- `user-manage.ts`

### 1. 总体特点

路由不是手动逐个 `import` 页面组件，而是通过：

- `import.meta.glob('/src/views/**/**.tsx')`

扫描 `views` 下的页面文件，再通过 `utils/mapping.ts` 把文件路径映射成组件名。

例如：

- `src/views/login/index.tsx`
- `src/views/task/synchronization-definition/index.tsx`

会按命名规则映射后用于路由注册。

这套机制的特点是：

- 页面文件位置和命名决定组件映射名
- 路由配置文件只关心页面名和路径
- 减少手写组件导入代码

### 2. 主要路由模块

当前主要路由模块包括：

- 登录页 `/login`
- 设置页 `/setting`
- 数据源模块 `/datasource/*`
- 任务模块 `/task/*`
- 用户管理模块 `/user-manage/*`
- 虚拟表模块 `/virtual-tables/*`

### 3. 布局挂载方式

除了登录页外，大多数业务页都挂在：

- `layouts/dashboard`

也就是说，业务页统一复用一个后台布局。

## 六、布局结构

后台布局入口在 `src/layouts/dashboard/index.tsx`。

整体结构是：

- 顶部 Header
- 左侧 Sidebar
- 中间内容区

### 1. Header

顶部 Header 包含三部分：

- Logo
- 顶部一级菜单
- 用户下拉菜单

顶部一级菜单在：

- `layouts/dashboard/header/menu/use-menu.ts`

目前菜单主要包括：

- `tasks`
- `datasource`
- `virtual-tables`
- `user-manage`

点击顶部菜单后直接跳到对应一级路由。

### 2. Sidebar

左侧 Sidebar 当前主要服务于任务模块，侧边菜单固定包含：

- 同步任务定义
- 同步任务实例

侧栏显示和高亮不是自动推导的，而是依赖路由 `meta` 控制：

- `meta.showSide`
- `meta.activeMenu`
- `meta.activeSide`

所以页面是否显示侧栏、顶部菜单高亮哪个模块、侧栏高亮哪一项，都由路由元信息驱动。

## 七、状态管理

状态管理使用 `Pinia`，但整体上 store 很轻，主要存放会话状态和 UI 状态，不承载复杂业务编排。

### 1. theme store

位置：

- `src/store/theme`

主要负责：

- 当前主题
- 是否暗色模式
- 顶部导航文字颜色

### 2. setting store

位置：

- `src/store/setting`

主要负责：

- 圆角大小
- 请求超时时间
- 当前语言
- workspace 列表

### 3. user store

位置：

- `src/store/user`

主要负责：

- 当前登录用户信息
- token 等会话信息持久化

### 4. datasource form store

位置：

- `src/store/datasource`

主要负责：

- 动态表单结构缓存

它的作用是避免反复请求相同数据源插件的表单结构。

### 5. synchronization-definition store

位置：

- `src/store/synchronization-definition`

主要负责：

- DAG 编排过程中的共享状态
- 列是否可选
- DAG 对应的任务信息

这个 store 是同步任务编排页中最重要的业务 store。

## 八、API 层组织

API 封装位于 `src/service`。

### 1. 通用请求封装

统一 axios 实例在：

- `src/service/service.ts`

它的职责包括：

- 设置统一 `baseURL` 为 `/seatunnel/api/v1`
- 从用户 store 中附加 token
- 统一处理接口返回结构
- 处理 `401`，清空登录态并跳转登录页

有一个很重要的特殊处理：

- 当调用 `/job/executor/execute` 时，即使后端返回“提交失败”，但如果已经返回了 `jobInstanceId`，前端仍然继续使用这个实例 ID，让后续实例页去展示真实执行状态

这说明前端已经适配了“实例先创建、实际提交可能失败”的后端行为。

### 2. API 按业务域拆分

目前主要按以下业务域划分：

- `service/data-source`
- `service/sync-task-definition`
- `service/sync-task-instance`
- `service/user`
- `service/virtual-table`
- `service/log`

这套组织方式比较清晰：

- 页面层不直接写请求细节
- 业务 API 按模块汇总
- 页面通过 hook 或页面逻辑组合调用这些 service

## 九、动态表单机制

这是整个前端里很关键的一层抽象。

位置：

- `src/components/dynamic-form/dynamic-form-item.tsx`

前端有大量配置页面不是把所有字段硬编码在页面里，而是由后端返回动态表单结构，前端按结构渲染。

动态表单目前支持的类型主要包括：

- `input`
- `select`
- `checkbox`

动态表单的作用主要体现在两个模块：

- 数据源创建 / 编辑
- 同步任务节点配置

这套机制的价值是：

- 不同插件可以复用同一套前端渲染逻辑
- 扩展新数据源或 connector 时，前端改动量更小
- 许多表单行为由后端定义，前端只负责通用展示与绑定

## 十、数据源模块

数据源相关页面位于：

- `src/views/datasource/list`
- `src/views/datasource/create`
- `src/views/datasource/components`

### 1. 列表页

列表页负责：

- 数据源分页查询
- 按名称搜索
- 新建入口
- 编辑入口
- 删除入口

### 2. 创建 / 编辑页

创建页和编辑页共用同一套页面逻辑。

页面大致分成两部分：

- 固定字段
  - 数据源类型
  - 数据源名称
  - 描述
- 动态字段
  - 由插件类型决定的连接参数

支持的操作包括：

- 选择数据源类型
- 测试连接
- 创建
- 更新

整体思路是：

1. 先确定插件类型
2. 拉取该插件对应的动态表单结构
3. 用通用组件渲染剩余配置项
4. 提交给后端保存

## 十一、登录与用户态

登录模块位于：

- `src/views/login`

### 1. 登录流程

登录页会先调用接口拉取可用工作空间列表。

用户填写：

- 用户名
- 密码
- workspace
- 是否使用 LDAP

然后调用登录接口。

成功后：

- 将用户信息写入 `userStore`
- 跳转到 `/tasks`

### 2. 用户菜单

Header 右上角用户菜单支持：

- 帮助
- 设置
- 登出

登出逻辑是：

1. 调用后端登出接口
2. 清空用户 store
3. 跳转登录页

## 十二、任务模块总体结构

任务模块位于：

- `src/views/task/synchronization-definition`
- `src/views/task/synchronization-instance`

它可以理解为整个前端最核心的业务模块。

主要分为两大块：

- 同步任务定义
- 同步任务实例监控

## 十三、同步任务定义模块

### 1. 列表页

位置：

- `src/views/task/synchronization-definition/index.tsx`

主要负责：

- 查询任务定义分页数据
- 按任务名搜索
- 新建同步任务
- 跳转到 DAG 编排页

### 2. DAG 编排页

位置：

- `src/views/task/synchronization-definition/dag`

这是整个前端最复杂、最核心的页面。

整体由三部分构成：

- 左侧节点面板 `DagSidebar`
- 中间画布 `DagCanvas`
- 顶部工具栏 `DagToolbar`

### 3. DAG 画布实现

画布基于：

- `@antv/x6`

关键实现文件包括：

- `dag/canvas/index.tsx`
- `dag/canvas/use-dag-graph.ts`
- `dag/canvas/use-dag-node.ts`
- `dag/canvas/dag-shape.ts`
- `dag/canvas/dag-data.ts`

前端在画布中完成的事情包括：

- 拖拽新增节点
- 连线
- 节点选中
- 节点双击编辑
- 删除节点
- 自动布局
- 从图结构提取 DAG 数据

### 4. 节点分类

当前 DAG 中的节点类型主要是：

- `source`
- `transform`
- `sink`

用户从左侧面板把这些节点拖入画布，再进行连接和配置。

### 5. 连线约束

前端对 DAG 连线做了显式限制，例如：

- 不能把线连到 source 节点
- sink 节点只能有一个输入
- transform 节点连接存在额外限制
- 某些 transform 之间不能互连

这说明 DAG 合法性不是完全交给后端，前端在交互层就做了一轮规则约束。

### 6. 节点编辑方式

双击节点会打开 `NodeSetting` 抽屉。

抽屉内部主要分两个 tab：

- `Configuration`
- `Model`

其中：

- `Configuration` 负责节点配置参数
- `Model` 负责字段模型、字段映射、字段选择相关能力

### 7. 节点配置表单

节点配置的核心文件是：

- `dag/configuration-form.tsx`

这个表单是“固定字段 + 动态字段”的组合：

固定字段例如：

- 节点名
- 场景模式 `sceneMode`
- 数据源实例
- 数据库
- 表名
- SQL 内容

动态字段例如：

- 不同 source / sink / transform 对应的专有参数
- 由后端返回表单结构后统一渲染

### 8. DAG 初始化

页面初始化时，会并行调用以下接口：

- 获取 DAG 节点和边
- 获取任务配置
- 获取任务详情

在此基础上还会对 source 节点做额外校验：

- 检查配置中的 database / table 是否仍然存在

如果校验失败：

- 页面会提示异常
- 并把失效的库表从节点配置中剔除

### 9. DAG 保存

保存 DAG 时，前端会把当前图结构转换成：

- `plugins`
- `edges`

并提交给后端。

后端返回后如果存在 schema 相关错误，前端不会简单提示“失败”，而是：

- 把错误映射到具体节点
- 标记节点异常状态
- 弹出详细错误消息

这说明前端不仅仅是图编辑器，还承担了错误回显和图状态同步职责。

### 10. 任务级设置

除了节点配置外，DAG 页面还有任务级设置弹窗：

- 任务名
- 描述
- 执行引擎
- 任务环境相关动态表单项

这部分用于补充 DAG 之外的全局任务配置。

## 十四、同步任务实例监控模块

位置：

- `src/views/task/synchronization-instance`

它负责任务运行态展示和监控。

### 1. 列表页

列表页支持：

- 按同步类型区分 `BATCH` 和 `STREAMING`
- 按任务名筛选
- 按执行人筛选
- 按状态筛选
- 按时间范围筛选
- 分页查询

### 2. 表格能力

实例列表表格支持：

- 自定义列展示
- 状态刷新
- 查看日志
- 查看详情

### 3. 日志查看

日志查看使用轮询累积的方式：

- 按 `taskInstanceId` 调用日志接口
- 每次拉一段日志
- 如果后端标记还有后续内容，则继续轮询追加

这种实现适合运行中任务的持续日志查看。

### 4. 实例详情页

详情页位于：

- `src/views/task/synchronization-instance/detail`

主要有三个 tab：

- 任务定义
- 运行实例
- 任务指标

这部分主要是把后端统计好的执行信息和指标做页面展示。

## 十五、整体实现风格总结

从代码结构和实现方式看，`seatunnel-ui` 有几个非常明确的特点。

### 1. 页面按业务域拆分

不是按组件技术分类，而是按业务模块组织：

- datasource
- task
- user-manage
- virtual-tables

这使得同一业务相关页面、hooks、子组件更容易集中维护。

### 2. 页面逻辑下沉到 use-xxx

复杂页面通常会把逻辑拆到：

- `use-form`
- `use-table`
- `use-detail`
- `use-dag-detail`
- `use-sync-task`

这样页面组件本身更偏向渲染层，逻辑更容易复用和阅读。

### 3. store 很轻

复杂业务没有过度堆进全局 store，而是：

- 页面内自己管理局部状态
- 只把跨页面、跨组件共享状态放入 Pinia

这是一个比较务实的设计。

### 4. 强依赖后端动态能力

前端没有把所有配置逻辑写死，而是强依赖后端提供：

- 动态表单结构
- 数据源支持列表
- connector 列表
- 字段模型 / schema 推导结果
- DAG 校验结果

这说明整个系统设计里，前端更多是通用编排与展示层。

### 5. DAG 编排是核心复杂度来源

普通后台页面整体不算复杂，真正复杂的是：

- 图编辑器
- 节点配置抽屉
- schema 和字段模型联动
- DAG 保存与错误回显

也就是说，如果后续需要深入理解 `seatunnel-ui`，优先级最高的仍然是同步任务 DAG 编排模块。

## 十六、建议重点阅读的文件

如果后续要继续深入，建议优先看下面这些文件：

- `src/service/service.ts`
- `src/router/routes.ts`
- `src/layouts/dashboard/index.tsx`
- `src/components/dynamic-form/dynamic-form-item.tsx`
- `src/views/datasource/create/index.tsx`
- `src/views/task/synchronization-definition/index.tsx`
- `src/views/task/synchronization-definition/dag/index.tsx`
- `src/views/task/synchronization-definition/dag/use-dag-detail.ts`
- `src/views/task/synchronization-definition/dag/configuration-form.tsx`
- `src/views/task/synchronization-definition/dag/canvas/index.tsx`
- `src/views/task/synchronization-instance/sync-task.tsx`

这几组文件基本覆盖了：

- 应用壳
- 动态表单
- 数据源配置
- DAG 编排
- 运行监控

## 十七、一句话总结

`seatunnel-ui` 是一个以任务编排和运行监控为核心的 Vue 3 后台前端。普通页面整体是标准管理台结构，真正的核心复杂度集中在“同步任务 DAG 编排 + 动态表单 + 字段模型/Schema 联动”这条主链路上。

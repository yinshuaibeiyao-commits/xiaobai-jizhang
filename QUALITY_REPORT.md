# 小白记账 综合代码质量报告

- 生成时间：2026-08-28
- 审计范围：`src/**`（`.ts`/`.tsx`，排除 `*.test.ts`）+ 配置文件（`package.json`、`electron-builder.yml`、`.npmrc`、`electron.vite.config.ts`、`tsconfig.json`、`vitest.config.ts`、`.gitignore`、`src/renderer/index.html`）
- 方法：静态审读 + 关键词/危险模式检索 + `npm audit`（含 `unset ELECTRON_RUN_AS_NODE`）+ 单元测试（31/31 通过）+ typecheck 确认
- 本轮背景：Electron 已从 33 升级到 44.0.0（运行时高危漏洞已修复），typecheck / 单元测试 / build 均通过；工作区改动主要为「补注释 + 测试 + 门禁基础设施」

## 结果总览

| 维度 | 问题数 | 分级 |
|---|---|---|
| 安全审计 | 7 条 | 严重 0 / 高 0 / 中 3 / 低 4 |
| 注释检查 | 5 条 | 缺失 5 / 不匹配 0 / 难懂 0 |
| 其它质量 | 9 条 | 正确性 4 / 错误处理 2 / 类型安全 1 / 可维护性 2 / 死代码 0 |

**合计 21 条**（全部为中/低，无必须阻断提交的问题）。

正面上：未发现硬编码凭据/密钥；无 SQL、命令注入、XSS 注入面（无 `innerHTML`/`dangerouslySetInnerHTML`/`eval`/`child_process`）；`dataPath` 为固定路径无路径遍历；无 `any` 滥用、无未使用导入；`nodeIntegration` 未开、`contextIsolation` 默认开启；**运行时 Electron 44.0.0 无已知公告漏洞，生产运行时 npm audit 为 0 漏洞**。

**门禁结论：通过** —— 安全审计维度无「严重/高」级别问题，生成标记文件 `.claude/checks/quality.passed`。

---

## 一、安全审计（7 条）

### 严重
无。

### 高
无。上一轮 Electron 33 的运行时高危漏洞（GHSA-8x5q-pvf5-64mp 等）已随升级到 44.0.0 修复，`npm audit` 中已无命中运行时的公告。

### 中
1. **渲染进程沙箱被关闭** — `src/main/index.ts:27`
   `sandbox: false`。preload 仅用 `contextBridge` + `ipcRenderer.invoke`（两者在沙箱化 preload 中均可用），无关闭沙箱的必要。当前应用只加载本地内容、无远程页面，实际可利用面有限；但开沙箱是 Electron 纵深防御的最佳实践。**建议**改为 `sandbox: true` 后跑通 build + 冒烟，若无异常即保留。

2. **外链未校验协议即交给系统打开** — `src/main/index.ts:36-39`
   `setWindowOpenHandler` 直接 `shell.openExternal(details.url)`，未限制协议白名单。当前渲染层无 `window.open` 调用，暂无实际触发面；但若未来渲染层被注入或加载远程内容，攻击者可借 `file://`、`ms-settings:` 等自定义协议拉起本地应用/程序。**建议**仅对 `http:`/`https:` 放行，其余 `return { action: 'deny' }`。

3. **构建期工具链依赖漏洞** — `package.json:25,26,30`（npm audit：15 项 = critical 1 / high 12 / moderate 2）
   全部位于 `devDependencies`，**不随安装包分发**（`electron-builder.yml` 仅打包 `out/**`，且本项目无任何生产依赖，构建产物不含这些包）：
   - `node-tar`（critical）：经 `@electron/rebuild` → `node-gyp` → `cacache` 引入，仅 npm install / 打包解压时使用；
   - `electron-builder@^25.1.8`（high，app-builder-lib / builder-util-runtime）：GHSA-7g7r-gx96-252g（AppImage 搜索路径）与 GHSA-p2f4-r6v6-j797（PRIVATE-TOKEN 泄露）均属于 **electron-updater 自动更新**流程，本项目未使用自动更新，不适用；
   - `esbuild`/`vite`（moderate）：开发服务器 CORS 问题，仅 dev 模式。
   修复需 `npm audit fix --force`（升 electron-builder@26 / vite@8，破坏性变更）。**建议**：作为独立维护任务规划升级（按 CLAUDE.md 规则需用户决定），非本轮提交的阻断项。

### 低
4. **IPC 主进程入口无输入校验（纵深防御）** — `src/main/index.ts:50-57`、`src/main/store.ts:67-83,104-122`
   所有 handler 将渲染层数据原样透传。`createTransaction`/`updateTransaction` 对 `amount` 未做 `Number.isFinite`/`>0` 校验（渲染层已校验，但主进程是安全边界，被注入后可写入非法金额/`NaN`/超长字符串污染数据文件）。**建议**在主进程入口做最小校验：金额有限且 >0、类型 ∈ {expense,income}、日期格式 YYYY-MM-DD、字符串长度上限。

5. **`.gitignore` 未覆盖环境变量/密钥类文件** — `.gitignore:1-16`
   当前无 `.env`、证书、私钥文件（未发现真实泄露），但缺 `.env*`、`*.pem`、`*.key`、`*.cer` 等条目。**建议**补上防患未然。

6. **渲染入口无 CSP** — `src/renderer/index.html:1-12`
   页面无 Content-Security-Policy。当前渲染层仅本地内容、无内联脚本与远程资源，React 默认转义输出，实际风险低；加 CSP 是 Electron 应用标准加固项。**建议**在 `<meta>` 中加入 `default-src 'self'; style-src 'self' 'unsafe-inline'`。

7. **webPreferences 建议显式声明安全项** — `src/main/index.ts:25-28`
   `contextIsolation` / `nodeIntegration` / `webSecurity` 均未显式设置，靠 Electron 默认值（true/false/true）。**建议**显式写出，避免未来版本默认值变化导致回归。

> 备注：未发现硬编码凭据/密钥；项目用 JSON 文件存储，当前无任何 SQL 代码；`dataPath` 为固定路径（非用户输入），无路径遍历风险；`randomUUID()` 生成 id 为密码学安全随机，无弱随机。

---

## 二、注释检查（5 条：缺失 5 / 不匹配 0 / 难懂 0）

**整体评价**：较上一轮大幅改善——`store.ts` 全部 12 个函数、`index.ts` 生命周期与 IPC 注册、`preload` 的 API 桥设计、`App.tsx` 的筛选/提交/删除/汇总、`EntryForm` 的 resetForm/today/eslint-disable 原因、`EntryList` 的时区易错点、`CategoryManager` 的 renames 构造、`main.tsx` 的非空断言均已有「为什么」级别注释；`eslint-disable` 与 `dataPath` 测试对齐等易误读处也已说明。密度约为 1:5，接近 3:7 参考值。剩余为低优先级补充项：

### 缺失
1. **`src/shared/categories.ts:48-51`** — `subcategoriesOf` 无注释。返回「找不到大类时返回空数组」的行为值得写一句（`EntryForm` 的二级下拉依赖它，空数组会让下拉为空而非报错）。
2. **`src/renderer/src/components/EntryForm.tsx:58-68`** — `handleTypeChange` / `handleL1Change` 无注释。其「切换一级分类时把二级重置到第一个小类」是显式行为选择，应写一句说明。
3. **`src/renderer/src/App.tsx:34-42`** — `load` / `loadCategories` 无注释。属平凡函数（拉列表/拉分类），可补也可不加，优先级最低。
4. **`src/renderer/src/components/CategoryManager.tsx:21-57`** — `startCreate` / `startEdit` / `closeForm` / `switchType` / `updateRow` / `addRow` / `removeRow` 均为直白的状态读写，无注释可接受；若想加强，可在 `startEdit` 上注明「用 original/value 记录原值，供 handleSave 构造 renames」。
5. **`src/shared/categories.ts:31-37`** — `presetCategoriesFor` / `presetL1Names` 平凡一行，可不加（仅列出备查）。

### 不匹配
无。逐条对照了注释与实现（金额规整、筛选排序、旧数据兼容、级联改名约束、eslint-disable 意图、时区处理、非空断言前提），未发现过时或张冠李戴。

### 难懂
无。注释均用小白可读语言，解释了「为什么」与「对用户意味着什么」。

---

## 三、其它质量（9 条）

### 正确性 / Bug 风险
1. **中 — `persist()` 非原子写，数据文件可能损坏** — `src/main/store.ts:32-35`
   每次增删改都直接 `writeFileSync` 覆盖原文件。若写入中途进程崩溃/断电/磁盘满，JSON 可能被截断成半截导致损坏。**建议**「写临时文件 + `fs.renameSync` 原子替换」，并保留一次备份。

2. **中 — `initStore` 吞掉所有异常，损坏文件会被静默覆盖** — `src/main/store.ts:43-64`
   `catch` 不区分「文件不存在」与「JSON 解析失败/权限不足」。文件损坏时应用静默以空数据启动，且之后任意一次写操作都会用空数据**永久覆盖**原文件，用户数据不可恢复。**建议**：文件存在但解析失败时先备份原文件（如改名 `xxx.json.bak`）再启动，并弹窗提示用户；区分 ENOENT 与其它错误。

3. **低 — 数据层未校验金额** — `src/main/store.ts:67-83,104-122`
   渲染层已校验（`EntryForm.tsx:73-77`），但 store 层对 `amount` 无 `Number.isFinite`/`>0` 纵深防御，被绕过时 `NaN`/`Infinity` 可落库。**建议**在 `normalizeAmount` 入口加有限性校验。

4. **低（疑似）— 筛选与总览语义混杂** — `src/renderer/src/App.tsx:55-59,85-93`
   `allL1Names` 同时含收支两类的预置分类名，筛选「支出」时一级分类下拉仍出现「工资」等收入类目；头部「收入/支出/结余」基于**筛选后的子集**计算，筛选生效时数值与「全部账目」含义不符，可能让用户误解。属设计取舍，**疑似**问题，建议在筛选生效时给头部总览加「（已筛选）」提示或改为基于全量计算。

### 错误处理
5. **中 — 记一笔/删除/加载无 try/catch，IPC 失败无用户反馈** — `src/renderer/src/App.tsx:34-42,62-78`
   `load`/`loadCategories`/`handleSubmit`/`handleDelete` 未捕获异常。主进程错误（如磁盘写满、`updateTransaction` 抛「记录不存在」）会变成未处理的 Promise rejection，界面无任何提示，用户以为操作成功。`CategoryManager.tsx:87-89,98-100` 已有「catch + alert」模式，**建议**统一：给 `App.tsx` 的写操作补 try/catch 并把 `(e as Error).message` 弹给用户。

6. **低 — `(e as Error).message` 对非 Error 拒绝值取不到信息** — `src/renderer/src/components/CategoryManager.tsx:88,99`
   IPC 拒绝值理论上可为任意值，`as Error` 断言下若 `message` 为 `undefined` 会弹「undefined」。**建议**改为 `e instanceof Error ? e.message : String(e)`。

### 类型安全
7. **低 — IPC 处理器参数为隐式 any** — `src/main/index.ts:50-57`
   `ipcMain.handle` 回调的 `input`/`filter`/`id` 由 Electron 类型推断为 `any`，主进程拿到未约束的运行时值。**建议**在 handler 入口显式标注类型并做最小校验（与安全低第 4 条同源）。

### 可维护性
8. **低 — `updateCustomCategory` 单函数过长** — `src/main/store.ts:153-213`
   56 行承载「改名校验 + 小类占用检查 + renames 校验 + 级联更新流水」四阶段，注释已很清晰但读起来仍需通读全段。**建议**拆为 `validateCategoryUpdate` / `applyCascadeRename` 等 helper 提高可测性与可读性。

9. **低 — `.npmrc` 的 `electron_mirror` 在 npm 10 已是未知配置项** — `.npmrc:1`
   每次 npm 命令都告警「Unknown project config electron_mirror，将在下个大版本失效」。功能上仍生效（镜像下载 Electron），但**建议**迁移为 npm 官方支持的 `ELECTRON_MIRROR` 环境变量，或升级后改用 `electron_mirror` 的新推荐写法，消除告警。

### 死代码 / 冗余
未发现：`uniqueStrings`、`ALL_CATEGORIES`、`presetCategoriesFor`、`presetL1Names`、`mergedCategories`、`subcategoriesOf`、`XiaobaiApi` 均有使用；无未使用导入/变量（已逐文件核对）。

---

## 结论

代码整体干净：无凭据泄露、无注入面、运行时 Electron 44 无已知漏洞、类型严格、测试全绿（31/31），注释质量较上轮显著提升。**当前无阻断提交的问题**，门禁判定**通过**。

后续可规划（均非本轮阻断项，按 CLAUDE.md 规则交由用户决策）：
1. **数据可靠性（中，正确性）** — 原子写 + initStore 区分损坏/缺失并备份，是唯一可能「静默丢数据」的真实风险，建议优先；
2. **构建工具链升级（中，安全）** — 消除 npm audit 中 devDependencies 的 15 项公告（需破坏性升级，另开任务）；
3. **Electron 加固三连（中→低）** — `sandbox: true`、外链协议白名单、IPC 主进程输入校验；
4. **统一错误提示（中，错误处理）** — App 写操作补 try/catch，避免静默失败。

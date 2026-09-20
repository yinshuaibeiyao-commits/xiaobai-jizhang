# 代码质量与安全说明

## 当前结论

项目已经针对 Electron 桌面应用的主要风险完成加固，核心设计可作为求职作品集中的工程实践展示。持续集成会在每次提交和拉取请求中执行类型检查、单元测试与生产构建。

## 已落实

### 安全边界

- BrowserWindow 显式开启 `sandbox`、`contextIsolation`、`webSecurity`，关闭 `nodeIntegration`。
- Renderer 只通过 preload 中的白名单 API 调用主进程，不暴露 `ipcRenderer`。
- 外部导航只允许 `http:`、`https:`；页面配置 CSP。
- IPC 接收的金额、日期、字符串、ID、筛选条件、分类与改名映射均在主进程进行运行时校验。
- `.gitignore` 排除环境变量、私钥和证书。

### 数据可靠性

- 保存时先完整写入临时文件，再原子替换正式文件；失败时保留旧数据。
- JSON 解析失败时备份损坏文件，不再静默清空并覆盖。
- 兼容旧版 `expenses` 字段和缺少 `type` 的历史记录。
- 删除仍被流水引用的分类或小类时主动阻止，防止孤儿数据。

### 用户体验与错误处理

- 数据载入、保存、删除失败均在界面显示可理解的错误信息。
- 损坏数据恢复时使用系统对话框提示备份位置。
- 保存失败时编辑表单不会被误清空。

### 工程化

- TypeScript 严格检查。
- Vitest 覆盖 Store 和分类核心逻辑，目前共 36 个测试用例。
- GitHub Actions 在 Windows + Node.js 22 环境运行 `npm ci`、typecheck、test、build。
- 提供统一的 `npm run check` 本地质量命令。

## 后续可增强项

1. 增加 Playwright Electron 端到端测试，覆盖真实 IPC 和窗口交互。
2. 增加数据导出、导入及从备份恢复的可视化操作。
3. 使用 JSON Schema 或迁移版本号管理未来数据结构升级。
4. 为安装包增加签名和 GitHub Release 自动发布流程。

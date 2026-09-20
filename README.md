# 小白记账

一款使用 Electron、React 与 TypeScript 开发的本地桌面记账应用。它覆盖收支录入、组合筛选、自定义两级分类和历史数据迁移，并重点处理桌面应用的数据可靠性与进程隔离问题。

[![CI](https://github.com/yinshuaibeiyao-commits/xiaobai-jizhang/actions/workflows/ci.yml/badge.svg)](https://github.com/yinshuaibeiyao-commits/xiaobai-jizhang/actions/workflows/ci.yml)

## 项目亮点

- **完整业务闭环**：新增、编辑、删除、筛选收支流水，支持 9 类支出、6 类收入和自定义两级分类。
- **数据可靠性**：采用“临时文件写入 → 原子替换”保存数据；文件损坏时先生成备份，再以空数据安全启动，避免静默覆盖原文件。
- **安全的 Electron 边界**：开启 `sandbox`、`contextIsolation` 和 `webSecurity`，通过 `contextBridge` 暴露最小 IPC 白名单。
- **主进程运行时校验**：金额、日期、文本长度、筛选范围及分类改名均在可信边界再次校验，不依赖前端表单。
- **持续集成**：GitHub Actions 自动执行类型检查、36 个单元测试和生产构建。

## 技术栈

| 层级 | 技术 |
|---|---|
| 桌面运行时 | Electron 44 |
| 界面 | React 18、TypeScript、Vite |
| 进程通信 | preload + contextBridge + IPC 白名单 |
| 持久化 | 本地 JSON、临时文件原子替换、损坏备份 |
| 质量保障 | Vitest、TypeScript、GitHub Actions |
| 打包 | electron-builder |

## 架构

```mermaid
flowchart LR
  UI[React Renderer] -->|window.api| PRELOAD[Preload / contextBridge]
  PRELOAD -->|白名单 IPC| MAIN[Electron Main]
  MAIN --> VALIDATE[运行时输入校验]
  VALIDATE --> STORE[Store 业务逻辑]
  STORE --> TMP[临时 JSON 文件]
  TMP -->|原子替换| DATA[用户数据文件]
  DATA -->|解析失败时备份| BACKUP[corrupt-*.bak]
```

## 快速开始

环境要求：Node.js 22 或更高版本。

```bash
npm ci
npm run dev
```

Windows 用户也可以在安装依赖后双击 `启动小白记账.bat`。

## 质量检查

```bash
# 类型检查 + 单元测试 + 生产构建
npm run check

# 单独生成覆盖率报告
npm run test:coverage
```

CI 使用锁文件执行 `npm ci`，然后依次运行类型检查、测试和构建。测试集中覆盖金额与日期边界、筛选排序、自定义分类级联更新、旧数据兼容、损坏文件恢复和原子写入。

## 构建安装包

```bash
npm run build:win
npm run build:mac
```

构建产物默认输出到 `dist/`。

## 数据与隐私

- 应用无需账号和网络，记账数据不会上传。
- 数据保存在 Electron `userData` 目录中的 `xiaobai-jizhang.json`。
- 每次保存先写入同目录临时文件，成功后再替换正式数据文件。
- 如果启动时发现 JSON 损坏，原文件会被复制为 `xiaobai-jizhang.json.corrupt-<时间戳>.bak`，应用会明确提示备份位置。

## 安全设计

- Renderer 不直接访问 Node.js；`nodeIntegration` 关闭。
- 外部链接仅允许 `http:` 与 `https:` 协议。
- 页面设置内容安全策略（CSP）。
- IPC 参数在主进程执行类型、范围和长度校验。
- 仓库忽略环境变量、私钥、证书、日志及本地数据产物。

## 项目结构

```text
src/
├── main/          # 窗口生命周期、IPC、业务存储与数据恢复
├── preload/       # 安全 API 桥
├── renderer/      # React 界面与交互
└── shared/        # 跨进程类型和预设分类
```

## 后续计划

- 增加月度趋势与分类占比图表
- 支持用户主动导出、导入和恢复备份
- 增加端到端测试与安装包自动发布

## License

[MIT](LICENSE)

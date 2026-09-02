# 小白记账

面向个人 / 家庭的本地记账应用，简单易用。记录每一笔支出与收入，支持两级分类，数据只保存在本机，无需联网。

## 功能特性

- **记一笔**：记录每笔收支 —— 金额（人民币）+ 两级分类 + 日期 + 备注（可选）
- **流水列表**：按时间倒序查看所有记录，可按类型 / 分类 / 日期筛选
- **编辑 / 删除**：修改或删除已有记录
- **两级分类**：预设 9 大支出分类 + 6 大收入分类
- **自定义分类**：可新增 / 编辑 / 删除自己的分类（预置分类不可修改，删除时若还有记录在用会禁止）

## 技术栈

- 桌面壳：[Electron](https://www.electronjs.org/)
- 前端：React 18 + TypeScript + Vite
- 持久化：本地 JSON 文件（Node `fs` 读写，无原生依赖，免编译）
- 打包：electron-builder（Windows 出 exe / macOS 出 dmg）

## 运行

```bash
# 安装依赖
npm install

# 开发模式启动
npm run dev
```

Windows 下也可以直接双击项目根目录的 `启动小白记账.bat`。

## 构建打包

```bash
# 编译（产出 out/）
npm run build

# 打包 Windows 安装包（exe）
npm run build:win

# 打包 macOS 安装包（dmg）
npm run build:mac
```

## 测试

```bash
# 运行单元测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 类型检查
npm run typecheck
```

## 数据存储

所有记账数据保存在本机用户目录下的 `xiaobai-jizhang.json` 文件中，不联网、不上传，数据只属于你自己。

## 分类设计

| 类型 | 一级大类 |
|---|---|
| 支出 | 餐饮 / 交通 / 购物 / 居住 / 娱乐 / 医疗 / 教育 / 人情 / 其他 |
| 收入 | 工资 / 兼职副业 / 理财收益 / 红包转账 / 报销退款 / 其他收入 |

## 项目结构

```
src/
├── main/          # Electron 主进程（窗口 + IPC + 数据存储）
├── preload/       # 预加载脚本（contextBridge 暴露 API）
├── renderer/      # React 前端界面
└── shared/        # 主进程与渲染进程共享的类型与分类定义
```

## License

[MIT](LICENSE)

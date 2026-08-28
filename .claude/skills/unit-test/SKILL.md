---
name: unit-test
description: 为小白记账项目的代码编写、执行单元测试并输出 Markdown 测试报告。技术栈为 Vitest（node 环境）+ @vitest/coverage-v8，覆盖 src/shared 纯逻辑与 src/main/store 数据层。当用户要求「写单元测试 / 跑测试 / 测试报告 / 测一下 XX / 用测试验证有没有 bug」时使用。
---

# unit-test — 单元测试

为项目代码编写单元测试、执行并生成 Markdown 测试报告。框架：Vitest；覆盖率：@vitest/coverage-v8。

## 执行步骤

### 0. 确认环境（首次或缺失时才做）

- 检查 `package.json` 是否已有 `vitest` 依赖与 `test` 脚本；缺失则执行
  `npm install -D vitest @vitest/coverage-v8` 并补充脚本：
  ```json
  "test": "vitest run",
  "test:coverage": "vitest run --coverage"
  ```
- 检查项目根目录是否存在 `vitest.config.ts`；缺失则按「已知配置」一节创建。

### 1. 确定测试对象

- 用户调用时若指定了文件 / 模块 / 函数（例如 `/unit-test store.ts` 或 `/unit-test categories`），只测该目标。
- 否则扫描 `src/shared/**` 与 `src/main/**`，找出可测的纯函数与数据层逻辑。
  - 首版范围**不测**：`src/main/index.ts`（Electron 主进程入口）、React 组件渲染（`src/renderer/**`）、`src/shared/types.ts`（纯类型）。

### 2. 编写测试

- 测试文件放在被测文件**同目录**，命名 `<原名>.test.ts`。
- 用 `describe` / `it` / `expect`，每个 `it` 只断言一件事；优先用 `toEqual` / `toThrow` 给出明确期望。
- 必须覆盖：正常路径 + 边界情况（空输入、非法值、金额精度、异常抛出等）。
- 路径别名已配好，直接使用：`@shared` → `src/shared`、`@renderer` → `src/renderer/src`。
- 测 `src/main/store.ts` 时，务必用「测试 store.ts 的方法」一节里的 mock 写法，不要碰真实文件系统。

### 3. 执行测试

- 运行前**先** `unset ELECTRON_RUN_AS_NODE`（本机会话常设此变量，会导致 Node 行为异常）。
- 一次性运行（不要用 watch 模式）：
  ```
  unset ELECTRON_RUN_AS_NODE; npx vitest run
  ```
  或 `unset ELECTRON_RUN_AS_NODE; npm test`
- 需要覆盖率时：
  ```
  unset ELECTRON_RUN_AS_NODE; npx vitest run --coverage
  ```
  或 `npm run test:coverage`

### 4. 生成报告

- 汇总结果写入项目根目录 `TEST_REPORT.md`，结构如下，并用中文填写：
  ```markdown
  # 单元测试报告

  - 生成时间：<日期>
  - 测试对象：<文件 / 模块名>
  - 执行命令：<实际命令>

  ## 结果总览
  - 测试文件：N 个，用例：M 个，通过：P 个，失败：F 个

  ## 覆盖率（如有）
  - 总体：语句 x% / 分支 y% / 函数 z% / 行 w%
  - 分文件列出每份被测文件的覆盖率

  ## 失败用例（如无则写「无」）
  - 每个失败用例：名称 + 真实报错信息

  ## 结论
  - 一句话总结：是否通过、能否合入、需修复的点
  ```
- 同时在终端向用户简述结果（不要只写文件不吭声）。

## 已知配置（vitest.config.ts）

```ts
import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer/src')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    watch: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/shared/**/*.ts', 'src/main/**/*.ts'],
      exclude: ['src/main/index.ts', 'src/shared/types.ts']
    }
  }
})
```

## 测试 store.ts 的方法（重要，已验证可用）

`src/main/store.ts` 有模块级状态，且依赖 `electron` 与 `fs`。用 `vi.mock` 替换两者，用内存 `Map` 模拟文件，避免触碰真实磁盘：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 用 vi.hoisted 创建可在 vi.mock 工厂里引用的共享状态（避免 import 提升导致 TDZ 报错）
const mem = vi.hoisted(() => ({ files: new Map<string, string>() }))

vi.mock('electron', () => ({
  app: { getPath: () => '/fake/userData' }
}))

vi.mock('fs', () => ({
  readFileSync: (p: string) => {
    const data = mem.files.get(p)
    if (data === undefined) throw new Error('ENOENT')
    return data
  },
  writeFileSync: (p: string, data: string) => {
    mem.files.set(p, data)
  }
}))

// 必须把 store 的 import 放在 vi.mock 之后（import 会提升，但 vi.mock 声明在前即可）
import { initStore, createTransaction, ... } from './store'

beforeEach(() => {
  mem.files.clear()
  initStore() // 重置模块级状态到空
})
```

要点：
- `initStore()` 会读文件失败后落到空状态，正好用来在 `beforeEach` 里复位。
- 金额断言注意浮点：用 `0.1 + 0.2` → `0.3` 这类能稳定断言四舍五入的用例，避免 `1.005` 这类二进制边界值导致偶发失败。

## 注意事项

- 只测纯逻辑与数据层；不要测 Electron 主进程入口与 GUI 组件渲染（首版范围外）。
- **不要**为了让测试通过而弱化断言或删除失败用例；失败要如实写进报告。
- **不要**改动被测源码来「迁就」测试，除非确认是被测代码的真实 bug，且先向用户说明。
- `coverage/` 是生成产物，已加入 .gitignore，无需提交。
- 覆盖率文本表有时不列出 100% 覆盖的文件（Vitest 显示问题），以 `coverage/index.html` 或 JSON 为准。

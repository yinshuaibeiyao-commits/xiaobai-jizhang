# 测试说明

## 自动化门禁

GitHub Actions 在 Windows + Node.js 22 环境执行：

```bash
npm ci
npm run typecheck
npm test
npm run build
```

工作流文件：`.github/workflows/ci.yml`。

## 测试清单

当前共有 2 个测试文件、36 个测试用例：

| 文件 | 用例数 | 范围 |
|---|---:|---|
| `src/main/store.test.ts` | 28 | 流水 CRUD、筛选排序、运行时校验、分类级联、旧数据迁移、损坏备份、原子写入 |
| `src/shared/categories.test.ts` | 8 | 预设分类、合并分类、子类查询 |

## 本地运行

```bash
npm run check
npm run test:coverage
```

HTML 覆盖率报告生成在 `coverage/index.html`。最终通过状态以仓库首页 CI 徽章和 Actions 运行记录为准。

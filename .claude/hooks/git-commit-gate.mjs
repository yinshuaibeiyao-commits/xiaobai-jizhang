// git commit 门禁脚本：由 PreToolUse hook 触发，拦截 git commit 前检查测试/质量标记是否齐全
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// 读取 PreToolUse hook 从 stdin 传入的 JSON（含 tool_input.command 与 cwd）
let raw = ''
for await (const chunk of process.stdin) raw += chunk

let input
try {
  input = JSON.parse(raw)
} catch {
  // 解析失败就放行：门禁脚本自身故障不应阻断提交
  process.exit(0)
}

const command = input?.tool_input?.command ?? ''
// 只拦 git commit（含 -m / --amend 等变体）；git add / git push 等其它命令一律放行
if (!/\bgit\s+commit\b/.test(command)) {
  process.exit(0)
}

const cwd = input?.cwd ?? process.cwd()
const testsOk = existsSync(join(cwd, '.claude', 'checks', 'tests.passed'))
const qualityOk = existsSync(join(cwd, '.claude', 'checks', 'quality.passed'))

if (testsOk && qualityOk) {
  process.exit(0) // 两个标记都在，放行
}

// 缺标记：exit 2 拦截，stderr 会作为反馈回喂给 Claude
process.stderr.write(
  '[提交门禁] 已拦截 git commit，原因：\n' +
    `  - 单元测试：${testsOk ? '✅ 已通过' : '❌ 未通过 / 未运行'}\n` +
    `  - 质量检查：${qualityOk ? '✅ 已通过' : '❌ 未通过 / 未运行'}\n` +
    '请先运行 gitcommit-agent（或 /gitcommit-agent）完成测试与质量检查后再提交。\n'
)
process.exit(2)

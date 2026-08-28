import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// 单元测试配置：与 electron.vite.config.ts 保持一致的路径别名
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
    // 一次性运行，退出进程（配合 CI / 技能自动化使用）
    watch: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/shared/**/*.ts', 'src/main/**/*.ts'],
      exclude: ['src/main/index.ts', 'src/shared/types.ts']
    }
  }
})

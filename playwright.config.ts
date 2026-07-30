import { defineConfig } from '@playwright/test';

/**
 * XSwitch E2E 测试配置
 *
 * 注意：Chrome 扩展测试必须使用 persistent context + 加载解压扩展，
 * 且需要使用 new headless 模式（旧 headless 不支持扩展）。
 * 运行前需先执行 `npm run build` 确保 build/ 目录产物最新。
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false, // 扩展测试共享 browser profile，串行执行
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
  },
});

/**
 * 测试环境配置
 *
 * - 使用 jsdom 作为 DOM 环境
 * - 使用 fake-indexeddb 模拟浏览器中的 indexedDB
 * - 扩展 Testing Library 的断言
 */

import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// 为 Node/jsdom 环境提供 indexedDB 实现，避免 E2E/集成测试失败
// fake-indexeddb 会自动在 global 上挂载 indexedDB 相关对象
import 'fake-indexeddb/auto';

// 扩展 Vitest 的 expect 方法
expect.extend(matchers);

// 每个测试后清理 DOM
afterEach(() => {
  cleanup();
});


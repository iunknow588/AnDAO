import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('@/services/AuthService', () => ({
  authService: {
    isAuthenticated: vi.fn(),
    isFirstLogin: vi.fn(),
  },
}));

import { authService } from '@/services/AuthService';
import { RequireAuth } from '@/components/Auth/RequireAuth';

describe('RequireAuth', () => {
  it('未登录时应展示登录/注册提示与安全提醒', async () => {
    vi.mocked(authService.isAuthenticated).mockReturnValue(false);
    vi.mocked(authService.isFirstLogin).mockResolvedValue(true);

    render(
      <MemoryRouter>
        <RequireAuth>
          <div>protected-content</div>
        </RequireAuth>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('检测到未注册钱包')).toBeInTheDocument();
    });

    expect(screen.getByText('登录')).toBeInTheDocument();
    expect(screen.getByText('注册')).toBeInTheDocument();
    expect(
      screen.getByText(/请务必保护好密码与私钥/),
    ).toBeInTheDocument();
    expect(screen.queryByText('protected-content')).not.toBeInTheDocument();
  });

  it('已登录时应渲染受保护内容', async () => {
    vi.mocked(authService.isAuthenticated).mockReturnValue(true);
    vi.mocked(authService.isFirstLogin).mockResolvedValue(false);

    render(
      <MemoryRouter>
        <RequireAuth>
          <div>protected-content</div>
        </RequireAuth>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('protected-content')).toBeInTheDocument();
    });
  });

  it('会话自动锁定事件后应切回未登录提示', async () => {
    let authed = true;
    vi.mocked(authService.isAuthenticated).mockImplementation(() => authed);
    vi.mocked(authService.isFirstLogin).mockResolvedValue(false);

    render(
      <MemoryRouter>
        <RequireAuth>
          <div>protected-content</div>
        </RequireAuth>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('protected-content')).toBeInTheDocument();
    });

    authed = false;
    act(() => {
      window.dispatchEvent(new CustomEvent('wallet:auto-locked'));
    });

    await waitFor(() => {
      expect(screen.getByText('钱包已锁定或未登录')).toBeInTheDocument();
    });
  });
});

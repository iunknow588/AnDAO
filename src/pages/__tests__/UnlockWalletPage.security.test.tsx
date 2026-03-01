import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UnlockWalletPage } from '@/pages/UnlockWalletPage';

vi.mock('@/services/AuthService', () => ({
  authService: {
    isAuthenticated: vi.fn(),
    isFirstLogin: vi.fn(),
    firstLogin: vi.fn(),
    login: vi.fn(),
  },
}));

import { authService } from '@/services/AuthService';

describe('UnlockWalletPage security reminder', () => {
  it('首次注册时应提示保护密码与私钥', async () => {
    vi.mocked(authService.isAuthenticated).mockReturnValue(false);
    vi.mocked(authService.isFirstLogin).mockResolvedValue(true);

    render(
      <MemoryRouter>
        <UnlockWalletPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '创建密码' })).toBeInTheDocument();
    });

    expect(screen.getByText(/请妥善保管密码与私钥/)).toBeInTheDocument();
  });
});

import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Address } from 'viem';
import { SponsorDashboardPage } from '@/pages/SponsorDashboardPage';

const mockedSponsorService = vi.hoisted(() => ({
  getApplicationsBySponsorWithSource: vi.fn(),
  reviewApplication: vi.fn(),
  deployAccountForUser: vi.fn(),
  updateContractWhitelist: vi.fn(),
  updateUserWhitelist: vi.fn(),
  syncWhitelistFromChain: vi.fn(),
}));

const mockedAccountStore = vi.hoisted(() => ({
  currentAccount: {
    address: '0x1111111111111111111111111111111111111111',
    owner: '0x2222222222222222222222222222222222222222',
    eoaAddress: '0x3333333333333333333333333333333333333333',
    sponsorId: 'sponsor-0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-1',
    chainId: 11155111,
    userType: 'sponsor',
  },
  currentAccountAddress: '0x1111111111111111111111111111111111111111',
  currentChainId: 11155111,
}));

vi.mock('@/stores', () => ({
  useStore: () => ({
    accountStore: mockedAccountStore,
  }),
}));

vi.mock('@/services/SponsorService', () => ({
  sponsorService: mockedSponsorService,
}));

function respondPasswordOnce(password: string): void {
  window.addEventListener(
    'wallet:request-password',
    ((event: Event) => {
      const requestId = (event as CustomEvent).detail?.requestId as string | undefined;
      if (!requestId) {
        return;
      }
      window.dispatchEvent(
        new CustomEvent('wallet:password-input', {
          detail: { requestId, password },
        })
      );
    }) as EventListener,
    { once: true }
  );
}

describe('SponsorDashboardPage whitelist actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSponsorService.getApplicationsBySponsorWithSource.mockResolvedValue({
      applications: [],
      dataSource: 'cache-only',
    });
    mockedSponsorService.syncWhitelistFromChain.mockResolvedValue({
      contractWhitelist: [],
      userWhitelist: [],
    });
    mockedSponsorService.updateContractWhitelist.mockResolvedValue(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );
    mockedSponsorService.updateUserWhitelist.mockResolvedValue(
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    );
  });

  it('should update contract whitelist on chain after password confirmation', async () => {
    render(
      <MemoryRouter>
        <SponsorDashboardPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('白名单管理'));
    await waitFor(() => expect(mockedSponsorService.syncWhitelistFromChain).toHaveBeenCalled());

    const textareas = screen.getAllByPlaceholderText('0x...');
    fireEvent.change(textareas[0], {
      target: {
        value:
          '0x4444444444444444444444444444444444444444\n0x5555555555555555555555555555555555555555',
      },
    });
    respondPasswordOnce('  pass123  ');
    fireEvent.click(screen.getByText('添加合约白名单'));

    await waitFor(() =>
      expect(mockedSponsorService.updateContractWhitelist).toHaveBeenCalledWith(
        'sponsor-0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-1',
        11155111,
        [
          '0x4444444444444444444444444444444444444444',
          '0x5555555555555555555555555555555555555555',
        ] as Address[],
        true,
        'pass123'
      )
    );
  });

  it('should remove user whitelist on chain after password confirmation', async () => {
    render(
      <MemoryRouter>
        <SponsorDashboardPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('白名单管理'));
    await waitFor(() => expect(mockedSponsorService.syncWhitelistFromChain).toHaveBeenCalled());

    const textareas = screen.getAllByPlaceholderText('0x...');
    fireEvent.change(textareas[1], {
      target: {
        value: '0x6666666666666666666666666666666666666666',
      },
    });
    respondPasswordOnce('pwd');
    fireEvent.click(screen.getByText('移除用户白名单'));

    await waitFor(() =>
      expect(mockedSponsorService.updateUserWhitelist).toHaveBeenCalledWith(
        'sponsor-0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-1',
        11155111,
        ['0x6666666666666666666666666666666666666666'] as Address[],
        false,
        'pwd'
      )
    );
  });
});

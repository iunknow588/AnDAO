import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserType } from '@/types';
import { SponsorDashboardPage } from '@/pages/SponsorDashboardPage';

vi.mock('@/stores', () => ({
  useStore: () => ({
    accountStore: {
      currentAccount: {
        address: '0x1111111111111111111111111111111111111111',
        userType: UserType.STANDARD,
      },
      currentAccountAddress: '0x1111111111111111111111111111111111111111',
      currentChainId: 11155111,
    },
  }),
}));

vi.mock('@/services/SponsorService', () => ({
  sponsorService: {
    getApplicationsBySponsorWithSource: vi.fn(async () => ({
      applications: [],
      dataSource: 'cache-only',
    })),
    reviewApplication: vi.fn(),
    deployAccountForUser: vi.fn(),
  },
}));

describe('SponsorDashboardPage guard', () => {
  it('非赞助商账户应被拦截并提示开通', () => {
    render(
      <MemoryRouter>
        <SponsorDashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('当前账户不是赞助商账户，无法访问赞助商仪表板。')).toBeInTheDocument();
    expect(screen.getByText('去开通赞助商')).toBeInTheDocument();
  });
});


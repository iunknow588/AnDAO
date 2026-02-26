/**
 * SponsorService单元测试
 * 
 * @module services/__tests__/SponsorService.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SponsorService } from '../SponsorService';
import { StorageProviderType } from '@/interfaces/IStorageProvider';
import { Address } from 'viem';

describe('SponsorService', () => {
  let sponsorService: SponsorService;
  
  beforeEach(() => {
    sponsorService = new SponsorService();
  });
  
  describe('getRecommendedSponsors', () => {
    it('should return list of recommended sponsors', async () => {
      const sponsors = await sponsorService.getRecommendedSponsors();
      
      expect(sponsors).toBeInstanceOf(Array);
      expect(sponsors.length).toBeGreaterThan(0);
      
      // 验证赞助商数据结构
      const sponsor = sponsors[0];
      expect(sponsor).toHaveProperty('id');
      expect(sponsor).toHaveProperty('address');
      expect(sponsor).toHaveProperty('name');
      expect(sponsor).toHaveProperty('approvalRate');
      expect(sponsor).toHaveProperty('avgWaitTime');
    });
    
    it('should sort sponsors by approval rate and wait time', async () => {
      const sponsors = await sponsorService.getRecommendedSponsors();
      
      if (sponsors.length > 1) {
        // 验证排序：通过率高的在前，相同通过率时等待时间短的在前
        for (let i = 0; i < sponsors.length - 1; i++) {
          const current = sponsors[i];
          const next = sponsors[i + 1];
          
          if (current.approvalRate !== next.approvalRate) {
            expect(current.approvalRate).toBeGreaterThanOrEqual(next.approvalRate);
          } else {
            expect(current.avgWaitTime).toBeLessThanOrEqual(next.avgWaitTime);
          }
        }
      }
    });
  });
  
  describe('selectSponsorByInviteCode', () => {
    it('should select sponsor by valid invite code', async () => {
      const sponsors = await sponsorService.getRecommendedSponsors();
      if (sponsors.length === 0) {
        return; // 跳过测试如果没有赞助商
      }
      
      const sponsor = sponsors[0];
      const inviteCode = `SPONSOR-${sponsor.id}`;
      
      const selectedSponsor = await sponsorService.selectSponsorByInviteCode(inviteCode);
      
      expect(selectedSponsor).toBeDefined();
      expect(selectedSponsor.id).toBe(sponsor.id);
    });
    
    it('should throw error for invalid invite code', async () => {
      await expect(
        sponsorService.selectSponsorByInviteCode('INVALID-CODE')
      ).rejects.toThrow();
    });
  });
  
  describe('createApplication', () => {
    it('should create application with valid params', async () => {
      const sponsors = await sponsorService.getRecommendedSponsors();
      if (sponsors.length === 0) {
        return; // 跳过测试如果没有赞助商
      }
      
      const sponsor = sponsors[0];
      const params = {
        accountAddress: '0x1234567890123456789012345678901234567890' as Address,
        ownerAddress: '0x2345678901234567890123456789012345678901' as Address,
        sponsorId: sponsor.id,
        chainId: 5001,
      };
      
      const application = await sponsorService.createApplication(params);
      
      expect(application).toBeDefined();
      expect(application.id).toBeDefined();
      expect(application.accountAddress).toBe(params.accountAddress);
      expect(application.ownerAddress).toBe(params.ownerAddress);
      expect(application.sponsorId).toBe(sponsor.id);
      expect(application.status).toBe('pending');
      expect(application.storageIdentifier).toBeDefined();
      expect(application.storageType).toBeDefined();
    });
    
    it('should throw error for invalid sponsor', async () => {
      const params = {
        accountAddress: '0x1234567890123456789012345678901234567890' as Address,
        ownerAddress: '0x2345678901234567890123456789012345678901' as Address,
        sponsorId: 'invalid-sponsor-id',
        chainId: 5001,
      };
      
      await expect(
        sponsorService.createApplication(params)
      ).rejects.toThrow();
    });
  });
  
  describe('getApplicationStatus', () => {
    it('should return status from cache', async () => {
      const sponsors = await sponsorService.getRecommendedSponsors();
      if (sponsors.length === 0) {
        return;
      }
      
      const sponsor = sponsors[0];
      const params = {
        accountAddress: '0x1234567890123456789012345678901234567890' as Address,
        ownerAddress: '0x2345678901234567890123456789012345678901' as Address,
        sponsorId: sponsor.id,
        chainId: 5001,
      };
      
      const application = await sponsorService.createApplication(params);
      const status = await sponsorService.getApplicationStatus(application.id);
      
      expect(status).toBe('pending');
    });
  });
  
  describe('registerOnChain', () => {
    it('should register sponsor with valid params', async () => {
      const params = {
        sponsorAddress: '0x1234567890123456789012345678901234567890' as Address,
        gasAccountAddress: '0x2345678901234567890123456789012345678901' as Address,
        sponsorInfo: {
          name: 'Test Sponsor',
          description: 'Test Description',
        },
        rules: {
          dailyLimit: 100,
          maxGasPerAccount: BigInt('1000000000000000'), // 0.001 MNT
          autoApprove: false,
        },
      };
      
      const sponsorId = await sponsorService.registerOnChain(params);
      
      expect(sponsorId).toBeDefined();
      expect(sponsorId).toContain('sponsor-');
    });
  });
  
  describe('reviewApplication', () => {
    it('should review application and update status', async () => {
      const sponsors = await sponsorService.getRecommendedSponsors();
      if (sponsors.length === 0) {
        return;
      }
      
      const sponsor = sponsors[0];
      const params = {
        accountAddress: '0x1234567890123456789012345678901234567890' as Address,
        ownerAddress: '0x2345678901234567890123456789012345678901' as Address,
        sponsorId: sponsor.id,
        chainId: 5001,
      };
      
      const application = await sponsorService.createApplication(params);
      
      await sponsorService.reviewApplication(
        sponsor.id,
        application.id,
        'approve'
      );
      
      const updatedStatus = await sponsorService.getApplicationStatus(application.id);
      expect(updatedStatus).toBe('approved');
    });
  });
  
  describe('createChannel', () => {
    it('should create channel with valid info', async () => {
      const params = {
        sponsorAddress: '0x1234567890123456789012345678901234567890' as Address,
        gasAccountAddress: '0x2345678901234567890123456789012345678901' as Address,
        sponsorInfo: {
          name: 'Test Sponsor',
        },
        rules: {
          dailyLimit: 100,
          maxGasPerAccount: BigInt('1000000000000000'),
          autoApprove: false,
        },
      };
      
      const sponsorId = await sponsorService.registerOnChain(params);
      
      const channelInfo = {
        name: 'Test Channel',
        description: 'Test Channel Description',
        inviteCode: 'TEST-CODE',
      };
      
      const channelId = await sponsorService.createChannel(sponsorId, channelInfo);
      
      expect(channelId).toBeDefined();
      expect(channelId).toContain('channel-');
    });
  });
  
  describe('setSponsorStorageConfig', () => {
    it('should set storage config for sponsor', async () => {
      const params = {
        sponsorAddress: '0x1234567890123456789012345678901234567890' as Address,
        gasAccountAddress: '0x2345678901234567890123456789012345678901' as Address,
        sponsorInfo: {
          name: 'Test Sponsor',
        },
        rules: {
          dailyLimit: 100,
          maxGasPerAccount: BigInt('1000000000000000'),
          autoApprove: false,
        },
      };
      
      const sponsorId = await sponsorService.registerOnChain(params);
      
      const config = {
        type: StorageProviderType.CUSTOM,
        name: 'Custom Storage',
        endpoint: 'https://custom-storage.com',
      };
      
      await sponsorService.setSponsorStorageConfig(sponsorId, config);
      
      const retrievedConfig = await sponsorService.getSponsorStorageConfig(sponsorId);
      expect(retrievedConfig).toBeDefined();
      expect(retrievedConfig?.type).toBe(StorageProviderType.CUSTOM);
    });
  });
});

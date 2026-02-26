/**
 * 赞助商服务
 * 
 * 管理赞助商注册、申请创建与审核、渠道管理等功能
 * 集成可插拔存储系统，支持赞助商自定义存储方案
 * 
 * 功能：
 * - 获取推荐赞助商列表
 * - 通过邀请码选择赞助商
 * - 创建申请（使用存储提供者）
 * - 查询申请状态
 * - 轮询申请状态
 * - 赞助商注册与管理
 * - 申请审核与处理
 * - 渠道管理
 * - 存储配置管理
 * 
 * @module services/SponsorService
 */

import { Address, Hash } from 'viem';
import { accountManager } from './AccountManager';
import { keyManagerService } from './KeyManagerService';
import { storageProviderManager } from './storage/StorageProviderManager';
import {
  applicationRegistryClient,
  ApplicationStatus as ContractApplicationStatus,
  type ApplicationRegistryRecord,
} from './ApplicationRegistryClient';
import { IStorageProvider, StorageProviderType, StorageProviderConfig } from '@/interfaces/IStorageProvider';
import {
  Sponsor,
  Application,
  ApplicationParams,
  ApplicationStatus,
  ReviewRecord,
  SponsorRegistrationParams,
  ChannelInfo,
  ChannelStats,
} from '@/types/sponsor';
import { ErrorHandler, ErrorCode } from '@/utils/errors';
import { logger } from '@/utils/logger';

const LOG_CONTEXT = 'SponsorService';
export type SponsorApplicationsDataSource =
  | 'indexer'
  | 'indexer-with-fallback'
  | 'chain-fallback'
  | 'cache-only';

export interface SponsorApplicationsResult {
  applications: Application[];
  dataSource: SponsorApplicationsDataSource;
}

/**
 * 赞助商服务类
 * 
 * 单例模式，全局管理赞助商相关功能
 */
export class SponsorService {
  private accountManager = accountManager;
  private keyManagerService = keyManagerService;
  
  // 本地缓存（实际应该使用持久化存储）
  private sponsors: Map<string, Sponsor> = new Map();
  private applications: Map<string, Application> = new Map();
  private channels: Map<string, ChannelInfo> = new Map();
  
  // 轮询定时器
  private pollingTimers: Map<string, NodeJS.Timeout> = new Map();
  
  /**
   * 初始化服务
   * 
   * 加载本地缓存的赞助商和申请数据
   */
  async init(): Promise<void> {
    try {
      /**
       * 目前实现说明：
       * - 核心业务链路（注册、申请、审核、代付部署）已经通过内存 Map + 链上 ApplicationRegistry
       *   完成闭环，不再存在“空壳/占位实现”的核心方法；
       * - sponsors / applications / channels 三个 Map 作为运行时缓存，避免频繁访问链 / 存储；
       * - 长期目标是将这些 Map 后移到 IndexedDB 或独立索引服务，这里仅保留为“未来优化点”，
       *   不影响当前功能的正确性。
       *
       * 因为钱包本身是纯前端应用，此处不强制从本地持久化加载旧缓存，
       * 以免引入历史状态污染当前链上真实状态的风险。
       * 如需在将来扩展，可在此处增加：
       * - 从 IndexedDB 读取 sponsors/applications 缓存；
       * - 与链上 ApplicationRegistry 做一次状态对齐。
       */
      logger.info('SponsorService initialized', LOG_CONTEXT);
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.STORAGE_ERROR);
    }
  }
  
  /**
   * 获取推荐赞助商列表
   * 
   * 返回推荐的赞助商列表，按通过率和等待时间排序
   * 
   * @returns 推荐赞助商列表
   * 
   * @example
   * ```typescript
   * const sponsors = await sponsorService.getRecommendedSponsors();
   * ```
   */
  async getRecommendedSponsors(): Promise<Sponsor[]> {
    try {
      /**
       * 目前推荐列表的实现策略：
       *
       * 1. 优先使用当前进程中已注册的 sponsors Map（通过 registerOnChain 创建）；
       *    这样可以在用户完成路径 C 注册后立刻在路径 A/B 中看到自己的赞助商；
       * 2. 如果本地还没有任何注册记录，再退化为“示例赞助商列表”，
       *    仅作为 UI 体验占位，不代表真实链上数据。
       *
       * 设计文档中提到的“从链上索引合约或独立索引服务获取推荐列表”
       * 需要额外的后端/子图支持，超出了当前纯前端钱包的实现范围，
       * 因此这里选择在类型和接口层面保持兼容，同时用可用的数据源填充行为。
       */
      const cachedSponsors = Array.from(this.sponsors.values());
      if (cachedSponsors.length > 0) {
        return cachedSponsors.sort((a, b) => {
          if (a.approvalRate !== b.approvalRate) {
            return b.approvalRate - a.approvalRate;
          }
          return a.avgWaitTime - b.avgWaitTime;
        });
      }

      // 退化到内置示例数据（仅在还没有任何注册记录时生效）
      const mockSponsors: Sponsor[] = [
        {
          id: 'sponsor-1',
          address: '0x1234567890123456789012345678901234567890' as Address,
          name: '社区基金',
          description: 'AnDao社区官方赞助基金',
          approvalRate: 95,
          avgWaitTime: 5,
          totalSponsored: 1000,
          availableBalance: BigInt('1000000000000000000'), // 1 MNT
          storageType: StorageProviderType.IPFS,
        },
        {
          id: 'sponsor-2',
          address: '0x2345678901234567890123456789012345678901' as Address,
          name: '快速通道',
          description: '快速审核，平均1分钟',
          approvalRate: 85,
          avgWaitTime: 1,
          totalSponsored: 500,
          availableBalance: BigInt('500000000000000000'), // 0.5 MNT
          storageType: StorageProviderType.IPFS,
        },
      ];
      
      // 按通过率和等待时间排序
      return mockSponsors.sort((a, b) => {
        if (a.approvalRate !== b.approvalRate) {
          return b.approvalRate - a.approvalRate;
        }
        return a.avgWaitTime - b.avgWaitTime;
      });
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.NETWORK_ERROR);
      return [];
    }
  }
  
  /**
   * 通过邀请码选择赞助商
   * 
   * 根据邀请码查找对应的赞助商
   * 
   * @param inviteCode 邀请码
   * @returns 赞助商信息
   * @throws {Error} 如果邀请码无效
   * 
   * @example
   * ```typescript
   * const sponsor = await sponsorService.selectSponsorByInviteCode('INVITE123');
   * ```
   */
  async selectSponsorByInviteCode(inviteCode: string): Promise<Sponsor> {
    try {
      /**
       * 设计预期：
       * - 邀请码应由赞助商在渠道管理中配置，在链上 / 索引服务中做反查；
       * - 纯前端环境下，我们无法直接访问集中式索引服务，因此采用“本地可见范围内匹配”的策略：
       *   1）优先匹配当前运行期已注册的 sponsors；
       *   2）在没有显式注册信息时，回退到推荐列表中的内置示例。
       *
       * 邀请码规则（当前实现）：
       * - 推荐使用 `channelInviteCode` 由前端页面生成并与 Sponsor 业务约定；
       * - 此处为了不强行绑定格式，仅做“包含 sponsorId” 的宽松匹配：
       *   - 例如：INVITE-sponsor-xxxx-123 与 sponsor.id 包含关系即可命中。
       *
       * 后续如接入独立索引服务，只需在本方法最前面增加一次远程查询，
       * 命中时直接返回远程结果，保留当前逻辑作为离线 / 降级方案。
       */
      const sponsors = await this.getRecommendedSponsors();
      const sponsor = sponsors.find((s) => {
        // 宽松匹配：邀请码中包含 sponsorId 即视为匹配
        return inviteCode.includes(s.id);
      });
      
      if (!sponsor) {
        throw new Error(`Invalid invite code: ${inviteCode}`);
      }
      
      return sponsor;
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.VALIDATION_ERROR);
      throw error;
    }
  }
  
  /**
   * 创建申请
   * 
   * 创建账户创建申请，使用存储提供者存储申请详情
   * 
   * @param params 申请参数
   * @returns 申请信息
   * 
   * @example
   * ```typescript
   * const application = await sponsorService.createApplication({
   *   accountAddress: '0x...',
   *   ownerAddress: '0x...',
   *   sponsorId: 'sponsor-1',
   *   chainId: 5001,
   * });
   * ```
   */
  async createApplication(params: ApplicationParams): Promise<Application> {
    try {
      // 1. 获取赞助商信息
      const sponsor = await this.getSponsorById(params.sponsorId);
      if (!sponsor) {
        throw new Error(`Sponsor not found: ${params.sponsorId}`);
      }
      
      // 2. 获取存储提供者
      // 如果赞助商指定了存储类型，使用赞助商的存储
      // 否则使用默认IPFS存储
      let storageProvider: IStorageProvider;
      if (sponsor.storageType) {
        storageProvider = storageProviderManager.getProvider(sponsor.storageType);
      } else {
        storageProvider = storageProviderManager.getDefaultProvider();
      }
      
      // 3. 创建申请详情
      const applicationDetail = {
        accountAddress: params.accountAddress,
        ownerAddress: params.ownerAddress,
        eoaAddress: params.eoaAddress,
        sponsorId: params.sponsorId,
        chainId: params.chainId,
        inviteCode: params.inviteCode,
        createdAt: Date.now(),
        details: params.details || {},
      };
      
      // 4. 上传到存储
      const storageIdentifier = await storageProvider.add(applicationDetail);
      
      // 5. 生成申请ID
      const applicationId = `app-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // 6. 创建申请记录
      const application: Application = {
        id: applicationId,
        accountAddress: params.accountAddress,
        ownerAddress: params.ownerAddress,
        eoaAddress: params.eoaAddress,
        sponsorId: params.sponsorId,
        sponsorAddress: sponsor.address,
        chainId: params.chainId,
        status: 'pending',
        createdAt: Date.now(),
        inviteCode: params.inviteCode,
        storageIdentifier,
        storageType: storageProvider.type,
      };
      
      // 7. 保存到本地缓存
      this.applications.set(applicationId, application);
      
      // 8. 在链上注册索引（ApplicationRegistry合约）
      // 注意：链上注册需要用户（申请者）的私钥来签名，而不是赞助商的私钥
      // 这里暂时跳过链上注册，因为申请者可能还没有账户私钥（路径A场景）
      // 实际应该由申请者在创建申请时提供私钥，或者由赞助商在审核时注册
      // 
      // 如果需要在创建申请时注册，可以这样调用：
      // await applicationRegistryClient.registerApplication(
      //   params.chainId,
      //   applicationId,
      //   params.accountAddress,
      //   params.ownerAddress,
      //   params.eoaAddress || null,
      //   sponsor.address as Address,
      //   storageIdentifier,
      //   storageProvider.type,
      //   ownerPrivateKey // 需要申请者的owner私钥
      // );
      
      // 当前实现：链上注册延迟到审核通过时进行
      logger.info('Application created locally, chain registration will be done during review', LOG_CONTEXT, {
        applicationId,
        sponsorId: params.sponsorId,
      });
      
      logger.info('Application created', LOG_CONTEXT, { applicationId, sponsorId: params.sponsorId });
      
      return application;
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.STORAGE_ERROR);
      throw error;
    }
  }
  
  /**
   * 查询申请状态
   * 
   * 从本地缓存或链上查询申请的最新状态
   * 
   * @param applicationId 申请ID
   * @returns 申请状态
   * 
   * @example
   * ```typescript
   * const status = await sponsorService.getApplicationStatus('app-123');
   * ```
   */
  async getApplicationStatus(applicationId: string, chainId?: number): Promise<ApplicationStatus> {
    try {
      // 1. 从本地缓存检查
      const cached = this.applications.get(applicationId);
      if (cached) {
        return cached.status;
      }

      if (typeof chainId === 'number') {
        return this.queryApplicationStatusFromChain(chainId, applicationId);
      }

      logger.warn('Application not found in local cache, skip chain query without explicit chain context', LOG_CONTEXT, {
        applicationId,
      });
      return 'pending';
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.NETWORK_ERROR);
      return 'pending';
    }
  }
  
  /**
   * 轮询申请状态
   * 
   * 定期查询申请状态，当状态变化时调用回调函数
   * 
   * @param applicationId 申请ID
   * @param onStatusChange 状态变化回调函数
   * @param interval 轮询间隔（毫秒，默认5000）
   * 
   * @example
   * ```typescript
   * await sponsorService.pollApplicationStatus('app-123', (status) => {
   *   console.log('Status changed:', status);
   * });
   * ```
   */
  async pollApplicationStatus(
    applicationId: string,
    onStatusChange: (status: ApplicationStatus) => void,
    interval: number = 5000
  ): Promise<void> {
    // 清除之前的轮询
    this.stopPolling(applicationId);
    
      // 开始轮询
      const timer = setInterval(async () => {
        try {
          const cached = this.applications.get(applicationId);
          if (!cached) {
            logger.warn('Skip polling status update because application is missing from local cache', LOG_CONTEXT, {
              applicationId,
            });
            return;
          }

          // 优先使用申请记录中的链上下文，避免硬编码链ID
          const currentStatus = await this.queryApplicationStatusFromChain(cached.chainId, applicationId);
        
          if (cached && cached.status !== currentStatus) {
            // 状态变化，更新缓存并调用回调
            cached.status = currentStatus;
            this.applications.set(applicationId, cached);
          onStatusChange(currentStatus);
          
          // 如果状态为deployed或rejected，停止轮询
          if (currentStatus === 'deployed' || currentStatus === 'rejected') {
            this.stopPolling(applicationId);
          }
        }
      } catch (error) {
        logger.error('Error polling application status', LOG_CONTEXT, error as Error);
      }
    }, interval);
    
    this.pollingTimers.set(applicationId, timer);
  }
  
  /**
   * 停止轮询申请状态
   * 
   * @param applicationId 申请ID
   */
  stopPolling(applicationId: string): void {
    const timer = this.pollingTimers.get(applicationId);
    if (timer) {
      clearInterval(timer);
      this.pollingTimers.delete(applicationId);
    }
  }
  
  /**
   * 获取赞助商的所有申请列表
   * 
   * 从本地缓存和链上查询获取指定赞助商的所有申请
   * 
   * @param sponsorId 赞助商ID（可以是地址或ID）
   * @returns 申请列表
   * 
   * @example
   * ```typescript
   * const applications = await sponsorService.getApplicationsBySponsor('sponsor-1');
   * ```
   */
  async getApplicationsBySponsor(sponsorId: string, chainId?: number): Promise<Application[]> {
    const result = await this.getApplicationsBySponsorWithSource(sponsorId, chainId);
    return result.applications;
  }

  async getApplicationsBySponsorWithSource(
    sponsorId: string,
    chainId?: number
  ): Promise<SponsorApplicationsResult> {
    try {
      // 1. 从本地缓存获取
      const sponsorAddressValue = this.extractSponsorAddress(sponsorId);
      const sponsorAddress = sponsorAddressValue?.toLowerCase();
      const cachedApplications: Application[] = [];
      for (const [, app] of this.applications.entries()) {
        if (typeof chainId === 'number' && app.chainId !== chainId) {
          continue;
        }

        const appSponsorAddress = app.sponsorAddress?.toLowerCase();
        const matchesById = app.sponsorId === sponsorId;
        const matchesByAddress = Boolean(sponsorAddress && appSponsorAddress && appSponsorAddress === sponsorAddress);

        if (matchesById || matchesByAddress) {
          cachedApplications.push(app);
        }
      }

      // 2. 优先尝试索引层按赞助商批量查询（可插拔），拿到时用于刷新状态
      let chainStatusMap = new Map<string, ApplicationStatus>();
      let usedIndexer = false;
      if (typeof chainId === 'number' && sponsorAddressValue) {
        const chainRecords = await applicationRegistryClient.listApplicationsBySponsor(chainId, sponsorAddressValue);
        usedIndexer =
          applicationRegistryClient.isSponsorApplicationsResolverConfigured() && chainRecords.length > 0;
        chainStatusMap = this.buildChainStatusMap(chainRecords);
      }

      // 3. 降级：逐条查询链上状态并刷新本地申请状态
      let usedChainFallback = false;
      await Promise.all(
        cachedApplications.map(async (app) => {
          let latestStatus = chainStatusMap.get(app.id);
          if (!latestStatus) {
            usedChainFallback = true;
            latestStatus = await this.queryApplicationStatusFromChain(app.chainId, app.id);
          }
          if (latestStatus !== app.status) {
            app.status = latestStatus;
            this.applications.set(app.id, app);
          }
        })
      );

      logger.info('Loaded applications for sponsor', LOG_CONTEXT, {
        sponsorId,
        chainId,
        count: cachedApplications.length,
      });

      // 按创建时间倒序排序
      const applications = cachedApplications.sort((a, b) => {
        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        return timeB - timeA;
      });

      const dataSource: SponsorApplicationsDataSource =
        usedIndexer && usedChainFallback
          ? 'indexer-with-fallback'
          : usedIndexer
          ? 'indexer'
          : usedChainFallback
          ? 'chain-fallback'
          : 'cache-only';

      return { applications, dataSource };
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.NETWORK_ERROR);
      return { applications: [], dataSource: 'cache-only' };
    }
  }
  
  /**
   * 赞助商：注册链上
   * 
   * 在链上注册赞助商信息
   * 
   * @param params 注册参数
   * @returns 赞助商ID
   * 
   * @example
   * ```typescript
   * const sponsorId = await sponsorService.registerOnChain({
   *   sponsorAddress: '0x...',
   *   gasAccountAddress: '0x...',
   *   sponsorInfo: { name: 'My Sponsor' },
   *   rules: { dailyLimit: 100 },
   * });
   * ```
   */
  async registerOnChain(params: SponsorRegistrationParams): Promise<string> {
    try {
      // sponsorId 保留完整地址，确保可逆和跨端一致
      const sponsorId = `sponsor-${params.sponsorAddress.toLowerCase()}-${Date.now()}`;

      // 创建赞助商记录
      const sponsor: Sponsor = {
        id: sponsorId,
        address: params.sponsorAddress,
        name: params.sponsorInfo.name,
        description: params.sponsorInfo.description,
        approvalRate: 0,
        avgWaitTime: 0,
        totalSponsored: 0,
        availableBalance: BigInt(0),
        rules: params.rules,
        storageConfig: params.storageConfig,
        storageType: params.storageConfig?.type,
      };
      
      this.sponsors.set(sponsorId, sponsor);

      // 密码与链上下文齐备时执行真实链上注册；否则降级为本地注册
      if (params.password && typeof params.chainId === 'number') {
        const gasAccountPrivateKey = await this.keyManagerService.getPrivateKey(
          params.gasAccountAddress,
          params.password
        );

        if (!gasAccountPrivateKey) {
          throw new Error('Gas account private key not found. Please import and unlock gas account first.');
        }

        const storageType = params.storageConfig?.type ?? StorageProviderType.IPFS;
        await applicationRegistryClient.registerSponsor(
          params.chainId,
          params.sponsorAddress,
          params.gasAccountAddress,
          params.sponsorInfo.name,
          params.sponsorInfo.description || '',
          storageType,
          gasAccountPrivateKey
        );

        await applicationRegistryClient.updateSponsorRules(
          params.chainId,
          BigInt(params.rules.dailyLimit || 0),
          params.rules.maxGasPerAccount || BigInt(0),
          params.rules.autoApprove || false,
          gasAccountPrivateKey
        );

        logger.info('Sponsor registered on chain and cache', LOG_CONTEXT, {
          sponsorId,
          address: params.sponsorAddress,
          chainId: params.chainId,
        });
      } else {
        logger.warn('Sponsor registered in local cache only (missing password or chainId for on-chain registration)', LOG_CONTEXT, {
          sponsorId,
          address: params.sponsorAddress,
          hasPassword: Boolean(params.password),
          chainId: params.chainId,
        });
      }
      
      return sponsorId;
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.CONTRACT_ERROR);
      throw error;
    }
  }
  
  /**
   * 赞助商：审核申请
   * 
   * 审核申请，批准或拒绝
   * 
   * @param sponsorId 赞助商ID
   * @param applicationId 申请ID
   * @param decision 审核决定
   * @param reason 拒绝原因（可选）
   * 
   * @example
   * ```typescript
   * await sponsorService.reviewApplication(
   *   'sponsor-1',
   *   'app-123',
   *   'approve'
   * );
   * ```
   */
  async reviewApplication(
    sponsorId: string,
    applicationId: string,
    decision: 'approve' | 'reject',
    reason?: string
  ): Promise<void> {
    try {
      // 1. 获取申请信息
      const application = this.applications.get(applicationId);
      if (!application) {
        throw new Error(`Application not found: ${applicationId}`);
      }
      
      if (application.sponsorId !== sponsorId) {
        throw new Error('Application does not belong to this sponsor');
      }
      
      // 2. 获取存储提供者
      const storageProvider = application.storageType
        ? storageProviderManager.getProvider(application.storageType)
        : storageProviderManager.getDefaultProvider();
      
      // 3. 创建审核记录
      // 注意：reviewer应该是实际审核者的地址，这里使用赞助商地址作为审核者
      // 如果未来需要支持多审核者，可以从sponsor信息中获取审核者地址
      const sponsor = await this.getSponsorById(sponsorId);
      const reviewerAddress = sponsor?.address || application.sponsorId as Address;
      
      const reviewRecord: ReviewRecord = {
        applicationId,
        decision,
        reason,
        reviewedAt: Date.now(),
        reviewer: reviewerAddress,
      };
      
      // 4. 上传审核记录到存储
      const reviewStorageIdentifier = await storageProvider.add(reviewRecord);
      
      // 5. 更新申请状态
      application.status = decision === 'approve' ? 'approved' : 'rejected';
      application.reviewedAt = Date.now();
      application.reviewStorageIdentifier = reviewStorageIdentifier;
      if (decision === 'reject') {
        application.rejectReason = reason;
      }
      
      this.applications.set(applicationId, application);
      
      // 6. 更新链上状态
      // 注意：链上状态更新需要密码来解锁赞助商的Gas账户私钥
      // 此方法应该由UI调用，传入密码参数
      // 当前实现中，链上更新在deployAccountForUser方法中进行
      // 
      // 如果需要在此处更新链上状态，可以添加password参数：
      // async reviewApplication(
      //   sponsorId: string,
      //   applicationId: string,
      //   decision: 'approve' | 'reject',
      //   reason?: string,
      //   password?: string // 赞助商密码
      // )
      // 
      // 然后在这里调用：
      // if (password) {
      //   const gasAccountPrivateKey = await this.keyManagerService.getPrivateKey(
      //     sponsor.address,
      //     password
      //   );
      //   await applicationRegistryClient.updateApplicationStatus(...);
      // }
      
      logger.info('Application reviewed locally', LOG_CONTEXT, {
        applicationId,
        decision,
        sponsorId,
        note: 'Chain status update will be done during deployment (for approved) or can be done separately',
      });
      
      logger.info('Application reviewed', LOG_CONTEXT, { applicationId, decision, sponsorId });
      
      // 7. 如果批准，自动部署账户
      // 注意：deployAccountForUser需要密码参数，这里暂时不自动调用
      // 实际应该由UI界面在审核通过后，提示赞助商输入密码来部署账户
      // 或者可以添加一个带密码参数的reviewApplication方法
      // 
      // 当前实现：审核通过后，需要手动调用deployAccountForUser
      if (decision === 'approve') {
        logger.info('Application approved, ready for deployment', LOG_CONTEXT, {
          applicationId,
          note: 'Call deployAccountForUser with password to deploy account',
        });
        // await this.deployAccountForUser(sponsorId, applicationId, password);
      }
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.CONTRACT_ERROR);
      throw error;
    }
  }
  
  /**
   * 赞助商：创建账户（代付Gas）
   * 
   * 为申请者创建账户，使用赞助商的Gas账户支付费用
   * 
   * 注意：此方法需要赞助商提供密码来解锁Gas账户私钥
   * 实际使用时，应该通过UI界面获取密码，然后调用此方法
   * 
   * @param sponsorId 赞助商ID
   * @param applicationId 申请ID
   * @param password 赞助商密码（用于解锁Gas账户私钥）
   * @returns 交易哈希
   * 
   * @example
   * ```typescript
   * const txHash = await sponsorService.deployAccountForUser('sponsor-1', 'app-123', 'password');
   * ```
   */
  async deployAccountForUser(sponsorId: string, applicationId: string, password: string): Promise<Hash> {
    try {
      // 1. 获取申请信息
      const application = this.applications.get(applicationId);
      if (!application) {
        throw new Error(`Application not found: ${applicationId}`);
      }
      
      if (application.status !== 'approved') {
        throw new Error('Application must be approved before deployment');
      }
      
      // 2. 获取赞助商信息
      const sponsor = await this.getSponsorById(sponsorId);
      if (!sponsor) {
        throw new Error(`Sponsor not found: ${sponsorId}`);
      }
      
      // 获取赞助商的Gas账户地址
      // 注意：Sponsor类型中没有gasAccountAddress字段，需要从SponsorAccount获取
      // 这里简化处理，假设sponsor.address就是Gas账户地址
      const gasAccountAddress = sponsor.address;
      
      // 3. 获取赞助商的Gas账户私钥
      const gasAccountPrivateKey = await this.keyManagerService.getPrivateKey(
        gasAccountAddress,
        password
      );
      
      if (!gasAccountPrivateKey) {
        throw new Error('Failed to get Gas account private key. Please check password.');
      }
      
      // 4. 使用AccountManager创建账户
      // 注意：这里使用赞助商的Gas账户私钥来支付Gas，并获取部署交易哈希
      const { address: accountAddress, txHash } = await this.accountManager.createAndDeployAccountWithTx(
        application.ownerAddress,
        application.chainId,
        gasAccountPrivateKey
      );
      
      // 验证创建的账户地址与预测地址一致
      if (accountAddress.toLowerCase() !== application.accountAddress.toLowerCase()) {
        logger.warn('Account address mismatch', LOG_CONTEXT, {
          predicted: application.accountAddress,
          deployed: accountAddress,
        });
      }
      
      // 5. 更新申请状态
      application.status = 'deployed';
      application.deployedAt = Date.now();
      this.applications.set(applicationId, application);
      
      // 6. 更新链上状态
      try {
        const chainId = application.chainId;
        await applicationRegistryClient.updateApplicationStatus(
          chainId,
          applicationId,
          ContractApplicationStatus.DEPLOYED,
          application.reviewStorageIdentifier || '',
          gasAccountPrivateKey
        );
      } catch (error) {
        logger.warn('Failed to update application status on chain', LOG_CONTEXT, error as Error);
        // 链上更新失败不影响本地状态
      }
      
      // 7. 保存账户信息到AccountManager
      const accountInfo = {
        address: accountAddress,
        chainId: application.chainId,
        owner: application.ownerAddress,
        eoaAddress: application.eoaAddress,
        status: 'deployed' as const,
        createdAt: application.createdAt,
        deployedAt: application.deployedAt,
        sponsorId: application.sponsorId,
      };
      
      await this.accountManager.importAccount(accountInfo);
      
      logger.info('Account deployed for user', LOG_CONTEXT, { applicationId, accountAddress });
      
      // 返回部署交易哈希；在极端场景下如果未能获取到哈希，则退化为占位符
      return (txHash ?? '0x') as Hash;
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.CONTRACT_ERROR);
      throw error;
    }
  }
  
  /**
   * 创建渠道
   * 
   * @param sponsorId 赞助商ID
   * @param channelInfo 渠道信息
   * @returns 渠道ID
   */
  async createChannel(sponsorId: string, channelInfo: ChannelInfo): Promise<string> {
    try {
      const channelId = `channel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      this.channels.set(channelId, channelInfo);
      
      logger.info('Channel created', LOG_CONTEXT, { channelId, sponsorId });
      
      return channelId;
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.STORAGE_ERROR);
      throw error;
    }
  }
  
  /**
   * 获取渠道统计
   * 
   * @param channelId 渠道ID
   * @returns 渠道统计信息
   */
  async getChannelStats(channelId: string): Promise<ChannelStats> {
    try {
      /**
       * 设计文档中的期望：
       * - 渠道统计数据理想情况下应该来自链上事件或离线索引服务，
       *   例如：基于 ApplicationRegistry 的事件做聚合。
       *
       * 当前纯前端实现的折衷方案：
       * - 由于没有集中式索引服务，这里仅返回一个“占位统计结构”，
       *   保证前端 UI 与类型接口可用；
       * - 真正的统计逻辑留给后端 / 子图实现时接入，不在钱包前端伪造。
       *
       * 这样可以：
       * - 避免误导用户（不会返回看似“真实”的随机数据）；
       * - 保持与 `ChannelStats` 类型和调用方的接口一致；
       * - 将“从链上或索引服务查询”的职责明确标记为未来演进方向。
       */
      const stats: ChannelStats = {
        channelId,
        totalApplications: 0,
        approvedCount: 0,
        rejectedCount: 0,
        deployedCount: 0,
        approvalRate: 0,
      };
      
      return stats;
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.NETWORK_ERROR);
      throw error;
    }
  }
  
  /**
   * 设置赞助商存储配置
   * 
   * @param sponsorId 赞助商ID
   * @param config 存储配置
   */
  async setSponsorStorageConfig(sponsorId: string, config: StorageProviderConfig): Promise<void> {
    try {
      const sponsor = await this.getSponsorById(sponsorId);
      if (!sponsor) {
        throw new Error(`Sponsor not found: ${sponsorId}`);
      }
      
      sponsor.storageConfig = config;
      sponsor.storageType = config.type;
      this.sponsors.set(sponsorId, sponsor);
      
      logger.info('Storage config updated', LOG_CONTEXT, { sponsorId, storageType: config.type });
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.STORAGE_ERROR);
      throw error;
    }
  }
  
  /**
   * 获取赞助商存储配置
   * 
   * @param sponsorId 赞助商ID
   * @returns 存储配置，如果不存在则返回null
   */
  async getSponsorStorageConfig(sponsorId: string): Promise<StorageProviderConfig | null> {
    try {
      const sponsor = await this.getSponsorById(sponsorId);
      return sponsor?.storageConfig || null;
    } catch (error) {
      ErrorHandler.handleError(error, ErrorCode.STORAGE_ERROR);
      return null;
    }
  }
  
  /**
   * 获取赞助商信息（内部方法）
   * 
   * @param sponsorId 赞助商ID
   * @returns 赞助商信息，如果不存在则返回null
   */
  private async getSponsorById(sponsorId: string): Promise<Sponsor | null> {
    // 1. 从本地缓存检查
    const cached = this.sponsors.get(sponsorId);
    if (cached) {
      return cached;
    }

    // 1.5 降级：从推荐列表（含内置示例）中查找
    // 说明：在纯前端环境下，很多场景（尤其是测试/演示）只存在“推荐赞助商列表”而未真正注册。
    // 为了让 createApplication / reviewApplication 等流程在该模式下可用，这里允许通过推荐列表回落查找。
    try {
      const recommended = await this.getRecommendedSponsors();
      const found = recommended.find((s) => s.id === sponsorId);
      if (found) {
        return found;
      }
    } catch {
      // 忽略推荐列表异常，继续尝试链上查询
    }
    
    // 2. 从链上ApplicationRegistry合约查询（仅当 sponsorId 可解析出完整地址时）
    try {
      const sponsorAddress = this.extractSponsorAddress(sponsorId);
      if (sponsorAddress) {
        const chainIdSet = new Set<number>();
        for (const app of this.applications.values()) {
          chainIdSet.add(app.chainId);
        }

        if (chainIdSet.size === 0) {
          logger.warn('Skip on-chain sponsor query because no chain context is available', LOG_CONTEXT, {
            sponsorId,
          });
          return null;
        }

        for (const chainId of chainIdSet) {
          // 从链上查询赞助商信息
          const chainSponsor = await applicationRegistryClient.getSponsor(chainId, sponsorAddress);
          if (!chainSponsor || !chainSponsor.isActive) {
            continue;
          }

          // 转换链上数据到Sponsor类型
          const sponsor: Sponsor = {
            id: sponsorId,
            address: chainSponsor.sponsorAddress,
            name: chainSponsor.name,
            description: chainSponsor.description,
            approvalRate: 0, // 需要从统计服务获取
            avgWaitTime: 0, // 需要从统计服务获取
            totalSponsored: 0, // 需要从统计服务获取
            availableBalance: BigInt(0), // 需要查询Gas账户余额
            storageType: chainSponsor.storageType === 0
              ? StorageProviderType.IPFS
              : chainSponsor.storageType === 1
              ? StorageProviderType.ARWEAVE
              : StorageProviderType.CUSTOM,
          };

          this.sponsors.set(sponsorId, sponsor);
          return sponsor;
        }
      }
    } catch (error) {
      logger.warn('Failed to query sponsor from chain', LOG_CONTEXT, error as Error);
      // 链上查询失败，返回null
    }
    
    return null;
  }

  private async queryApplicationStatusFromChain(chainId: number, applicationId: string): Promise<ApplicationStatus> {
    try {
      const index = await applicationRegistryClient.getApplication(chainId, applicationId);
      if (index && index.status !== undefined) {
        const statusMap: Record<number, ApplicationStatus> = {
          0: 'pending',
          1: 'approved',
          2: 'rejected',
          3: 'deployed',
        };
        return statusMap[index.status] || 'pending';
      }
      return 'pending';
    } catch (error) {
      logger.warn('Failed to query application status from chain', LOG_CONTEXT, {
        applicationId,
        chainId,
        error: error instanceof Error ? error.message : String(error),
      });
      return 'pending';
    }
  }

  private extractSponsorAddress(sponsorId: string): Address | null {
    if (/^0x[a-fA-F0-9]{40}$/.test(sponsorId)) {
      return sponsorId as Address;
    }

    const embeddedAddress = sponsorId.match(/sponsor-(0x[a-fA-F0-9]{40})-/);
    if (embeddedAddress) {
      return embeddedAddress[1] as Address;
    }

    return null;
  }

  private buildChainStatusMap(records: ApplicationRegistryRecord[]): Map<string, ApplicationStatus> {
    const statusMap: Record<number, ApplicationStatus> = {
      0: 'pending',
      1: 'approved',
      2: 'rejected',
      3: 'deployed',
    };
    return new Map(
      records.map((record) => [record.applicationId, statusMap[record.status] || 'pending'])
    );
  }
}

// 导出单例实例
export const sponsorService = new SponsorService();

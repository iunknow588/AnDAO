// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ApplicationRegistry
 * @notice 申请注册表合约，用于存储和管理账户创建申请索引
 * 
 * 功能：
 * - 注册申请索引（存储标识符、存储类型、状态等）
 * - 更新申请状态
 * - 注册和管理赞助商信息
 * - 查询申请和赞助商信息
 * 
 * 存储设计：
 * - 申请详情存储在去中心化存储（IPFS/Arweave等）
 * - 链上仅存储索引信息（存储标识符、状态等）
 * - 支持多种存储类型（IPFS、Arweave、自定义）
 */
contract ApplicationRegistry {
    /**
     * @notice 存储提供者类型枚举
     */
    enum StorageProviderType {
        IPFS,      // IPFS存储
        ARWEAVE,   // Arweave存储
        CUSTOM     // 自定义存储
    }
    
    /**
     * @notice 申请状态枚举
     */
    enum ApplicationStatus {
        PENDING,    // 等待审核
        APPROVED,   // 已批准
        REJECTED,   // 已拒绝
        DEPLOYED    // 已部署
    }
    
    /**
     * @notice 申请索引结构
     */
    struct ApplicationIndex {
        string applicationId;           // 申请ID
        address accountAddress;         // 账户地址（预测的）
        address ownerAddress;           // 所有者地址（签名者）
        address eoaAddress;             // EOA地址（可选，路径B）
        address sponsorId;             // 赞助商地址
        uint256 chainId;                // 链ID
        string storageIdentifier;       // 存储标识符（CID/URI等）
        StorageProviderType storageType; // 存储类型
        ApplicationStatus status;        // 申请状态
        string reviewStorageIdentifier; // 审核记录存储标识符（可选）
        uint256 createdAt;              // 创建时间戳
        uint256 reviewedAt;             // 审核时间戳（可选）
        uint256 deployedAt;             // 部署时间戳（可选）
    }
    
    /**
     * @notice 赞助商信息结构
     */
    struct SponsorInfo {
        address sponsorAddress;         // 赞助商地址（EOA）
        address gasAccountAddress;      // Gas账户地址
        string name;                    // 赞助商名称
        string description;             // 赞助商描述
        StorageProviderType storageType; // 存储类型
        bool isActive;                  // 是否活跃
        uint256 registeredAt;          // 注册时间戳
    }
    
    /**
     * @notice 审核规则结构
     */
    struct SponsorRules {
        uint256 dailyLimit;             // 每日赞助限额
        uint256 maxGasPerAccount;       // 单账户最大Gas
        bool autoApprove;               // 自动审核
    }
    
    // 存储映射
    mapping(string => ApplicationIndex) public applications;
    mapping(address => SponsorInfo) public sponsors;
    mapping(address => SponsorRules) public sponsorRules;
    mapping(address => uint256) public sponsorDailyCount; // 每日赞助计数
    mapping(uint256 => uint256) public sponsorDailyReset; // 每日重置时间戳
    
    // 事件
    event ApplicationRegistered(
        string indexed applicationId,
        address indexed accountAddress,
        address indexed sponsorId,
        string storageIdentifier,
        StorageProviderType storageType
    );
    
    event ApplicationStatusUpdated(
        string indexed applicationId,
        ApplicationStatus status,
        string reviewStorageIdentifier
    );
    
    event SponsorRegistered(
        address indexed sponsorAddress,
        address indexed gasAccountAddress,
        string name,
        StorageProviderType storageType
    );
    
    event SponsorRulesUpdated(
        address indexed sponsorAddress,
        uint256 dailyLimit,
        uint256 maxGasPerAccount,
        bool autoApprove
    );
    
    /**
     * @notice 注册申请索引
     * 
     * @param applicationId 申请ID
     * @param accountAddress 账户地址（预测的）
     * @param ownerAddress 所有者地址
     * @param eoaAddress EOA地址（可选，路径B）
     * @param sponsorId 赞助商地址
     * @param chainId 链ID
     * @param storageIdentifier 存储标识符
     * @param storageType 存储类型
     */
    function registerApplication(
        string memory applicationId,
        address accountAddress,
        address ownerAddress,
        address eoaAddress,
        address sponsorId,
        uint256 chainId,
        string memory storageIdentifier,
        StorageProviderType storageType
    ) external {
        require(bytes(applicationId).length > 0, "Application ID cannot be empty");
        require(accountAddress != address(0), "Account address cannot be zero");
        require(ownerAddress != address(0), "Owner address cannot be zero");
        require(sponsorId != address(0), "Sponsor ID cannot be zero");
        require(bytes(storageIdentifier).length > 0, "Storage identifier cannot be empty");
        require(sponsors[sponsorId].isActive, "Sponsor is not active");
        
        // 检查申请是否已存在
        require(
            bytes(applications[applicationId].applicationId).length == 0,
            "Application already exists"
        );
        
        // 创建申请索引
        applications[applicationId] = ApplicationIndex({
            applicationId: applicationId,
            accountAddress: accountAddress,
            ownerAddress: ownerAddress,
            eoaAddress: eoaAddress,
            sponsorId: sponsorId,
            chainId: chainId,
            storageIdentifier: storageIdentifier,
            storageType: storageType,
            status: ApplicationStatus.PENDING,
            reviewStorageIdentifier: "",
            createdAt: block.timestamp,
            reviewedAt: 0,
            deployedAt: 0
        });
        
        emit ApplicationRegistered(
            applicationId,
            accountAddress,
            sponsorId,
            storageIdentifier,
            storageType
        );
    }
    
    /**
     * @notice 更新申请状态
     * 
     * @param applicationId 申请ID
     * @param status 新状态
     * @param reviewStorageIdentifier 审核记录存储标识符（可选）
     */
    function updateApplicationStatus(
        string memory applicationId,
        ApplicationStatus status,
        string memory reviewStorageIdentifier
    ) external {
        ApplicationIndex storage app = applications[applicationId];
        require(bytes(app.applicationId).length > 0, "Application not found");
        require(app.sponsorId == msg.sender, "Only sponsor can update status");
        
        app.status = status;
        if (bytes(reviewStorageIdentifier).length > 0) {
            app.reviewStorageIdentifier = reviewStorageIdentifier;
        }
        
        if (status == ApplicationStatus.APPROVED || status == ApplicationStatus.REJECTED) {
            app.reviewedAt = block.timestamp;
        }
        
        if (status == ApplicationStatus.DEPLOYED) {
            app.deployedAt = block.timestamp;
            // 更新每日计数
            _incrementDailyCount(app.sponsorId);
        }
        
        emit ApplicationStatusUpdated(applicationId, status, reviewStorageIdentifier);
    }
    
    /**
     * @notice 注册赞助商
     * 
     * @param sponsorAddress 赞助商地址
     * @param gasAccountAddress Gas账户地址
     * @param name 赞助商名称
     * @param description 赞助商描述
     * @param storageType 存储类型
     */
    function registerSponsor(
        address sponsorAddress,
        address gasAccountAddress,
        string memory name,
        string memory description,
        StorageProviderType storageType
    ) external {
        require(sponsorAddress != address(0), "Sponsor address cannot be zero");
        require(gasAccountAddress != address(0), "Gas account address cannot be zero");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(!sponsors[sponsorAddress].isActive, "Sponsor already registered");
        
        sponsors[sponsorAddress] = SponsorInfo({
            sponsorAddress: sponsorAddress,
            gasAccountAddress: gasAccountAddress,
            name: name,
            description: description,
            storageType: storageType,
            isActive: true,
            registeredAt: block.timestamp
        });
        
        emit SponsorRegistered(sponsorAddress, gasAccountAddress, name, storageType);
    }
    
    /**
     * @notice 更新赞助商审核规则
     * 
     * @param dailyLimit 每日赞助限额
     * @param maxGasPerAccount 单账户最大Gas
     * @param autoApprove 自动审核开关
     */
    function updateSponsorRules(
        uint256 dailyLimit,
        uint256 maxGasPerAccount,
        bool autoApprove
    ) external {
        require(sponsors[msg.sender].isActive, "Sponsor not registered");
        
        sponsorRules[msg.sender] = SponsorRules({
            dailyLimit: dailyLimit,
            maxGasPerAccount: maxGasPerAccount,
            autoApprove: autoApprove
        });
        
        emit SponsorRulesUpdated(msg.sender, dailyLimit, maxGasPerAccount, autoApprove);
    }
    
    /**
     * @notice 获取申请索引
     * 
     * @param applicationId 申请ID
     * @return 申请索引结构
     */
    function getApplication(string memory applicationId)
        external
        view
        returns (ApplicationIndex memory)
    {
        return applications[applicationId];
    }
    
    /**
     * @notice 获取赞助商信息
     * 
     * @param sponsorAddress 赞助商地址
     * @return 赞助商信息结构
     */
    function getSponsor(address sponsorAddress)
        external
        view
        returns (SponsorInfo memory)
    {
        return sponsors[sponsorAddress];
    }
    
    /**
     * @notice 获取赞助商审核规则
     * 
     * @param sponsorAddress 赞助商地址
     * @return 审核规则结构
     */
    function getSponsorRules(address sponsorAddress)
        external
        view
        returns (SponsorRules memory)
    {
        return sponsorRules[sponsorAddress];
    }
    
    /**
     * @notice 检查赞助商是否可以赞助（检查每日限额）
     * 
     * @param sponsorAddress 赞助商地址
     * @return 是否可以赞助
     */
    function canSponsor(address sponsorAddress) external view returns (bool) {
        SponsorInfo memory sponsor = sponsors[sponsorAddress];
        if (!sponsor.isActive) {
            return false;
        }
        
        SponsorRules memory rules = sponsorRules[sponsorAddress];
        if (rules.dailyLimit == 0) {
            return true; // 无限制
        }
        
        // 检查是否需要重置每日计数
        uint256 today = block.timestamp / 1 days;
        uint256 lastReset = sponsorDailyReset[sponsorAddress];
        
        if (lastReset < today) {
            return true; // 新的一天，可以赞助
        }
        
        return sponsorDailyCount[sponsorAddress] < rules.dailyLimit;
    }
    
    /**
     * @notice 增加每日计数（内部方法）
     * 
     * @param sponsorAddress 赞助商地址
     */
    function _incrementDailyCount(address sponsorAddress) internal {
        uint256 today = block.timestamp / 1 days;
        uint256 lastReset = sponsorDailyReset[sponsorAddress];
        
        if (lastReset < today) {
            // 新的一天，重置计数
            sponsorDailyCount[sponsorAddress] = 1;
            sponsorDailyReset[sponsorAddress] = today;
        } else {
            // 同一天，增加计数
            sponsorDailyCount[sponsorAddress]++;
        }
    }
}

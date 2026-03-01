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
        address targetContractAddress;  // 目标业务合约地址（可选）
        uint256 chainId;                // 链ID
        string storageIdentifier;       // 存储标识符（CID/URI等）
        StorageProviderType storageType; // 存储类型
        ApplicationStatus status;        // 申请状态
        string reviewStorageIdentifier; // 审核记录存储标识符（可选）
        uint256 createdAt;              // 创建时间戳
        uint256 reviewedAt;             // 审核时间戳（可选）
        uint256 deployedAt;             // 部署时间戳（可选）
    }

    struct RegisterApplicationInput {
        string applicationId;
        address accountAddress;
        address ownerAddress;
        address eoaAddress;
        address sponsorId;
        address targetContractAddress;
        uint256 chainId;
        string storageIdentifier;
        StorageProviderType storageType;
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
    mapping(address => uint256) public sponsorDailyReset; // 每日重置时间戳
    mapping(address => mapping(address => bool)) public sponsorContractWhitelist;
    mapping(address => mapping(address => bool)) public sponsorUserWhitelist;
    mapping(address => uint256) public sponsorContractWhitelistCount;
    mapping(address => uint256) public sponsorUserWhitelistCount;
    mapping(address => address[]) private sponsorContractWhitelistEntries;
    mapping(address => address[]) private sponsorUserWhitelistEntries;
    mapping(address => mapping(address => uint256)) private sponsorContractWhitelistIndexPlusOne;
    mapping(address => mapping(address => uint256)) private sponsorUserWhitelistIndexPlusOne;
    mapping(address => string[]) private sponsorApplicationIds;
    
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
    
    event SponsorContractWhitelistUpdated(
        address indexed sponsorAddress,
        address indexed targetContract,
        bool allowed
    );

    event SponsorUserWhitelistUpdated(
        address indexed sponsorAddress,
        address indexed user,
        bool allowed
    );
    
    /**
     * @notice 注册申请索引
     * 
     * @param input 注册申请参数
     */
    function registerApplication(RegisterApplicationInput calldata input) external {
        require(bytes(input.applicationId).length > 0, "Application ID cannot be empty");
        require(input.accountAddress != address(0), "Account address cannot be zero");
        require(input.ownerAddress != address(0), "Owner address cannot be zero");
        require(input.sponsorId != address(0), "Sponsor ID cannot be zero");
        require(bytes(input.storageIdentifier).length > 0, "Storage identifier cannot be empty");
        require(sponsors[input.sponsorId].isActive, "Sponsor is not active");
        _requireSponsorEligible(
            input.sponsorId,
            input.targetContractAddress,
            input.ownerAddress,
            input.eoaAddress
        );
        
        // 检查申请是否已存在
        require(
            bytes(applications[input.applicationId].applicationId).length == 0,
            "Application already exists"
        );
        
        _storeApplication(
            input.applicationId,
            input.accountAddress,
            input.ownerAddress,
            input.eoaAddress,
            input.sponsorId,
            input.targetContractAddress,
            input.chainId,
            input.storageIdentifier,
            input.storageType
        );
        sponsorApplicationIds[input.sponsorId].push(input.applicationId);
        
        emit ApplicationRegistered(
            input.applicationId,
            input.accountAddress,
            input.sponsorId,
            input.storageIdentifier,
            input.storageType
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

    function setSponsorContractWhitelist(address[] calldata targetContracts, bool allowed) external {
        require(sponsors[msg.sender].isActive, "Sponsor not registered");

        for (uint256 i = 0; i < targetContracts.length; i++) {
            address target = targetContracts[i];
            require(target != address(0), "Target contract cannot be zero");
            bool current = sponsorContractWhitelist[msg.sender][target];

            if (allowed && !current) {
                sponsorContractWhitelist[msg.sender][target] = true;
                sponsorContractWhitelistCount[msg.sender] += 1;
                sponsorContractWhitelistEntries[msg.sender].push(target);
                sponsorContractWhitelistIndexPlusOne[msg.sender][target] =
                    sponsorContractWhitelistEntries[msg.sender].length;
            } else if (!allowed && current) {
                sponsorContractWhitelist[msg.sender][target] = false;
                sponsorContractWhitelistCount[msg.sender] -= 1;
                _removeSponsorContractWhitelistEntry(msg.sender, target);
            }

            emit SponsorContractWhitelistUpdated(msg.sender, target, allowed);
        }
    }

    function setSponsorUserWhitelist(address[] calldata users, bool allowed) external {
        require(sponsors[msg.sender].isActive, "Sponsor not registered");

        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            require(user != address(0), "User cannot be zero");
            bool current = sponsorUserWhitelist[msg.sender][user];

            if (allowed && !current) {
                sponsorUserWhitelist[msg.sender][user] = true;
                sponsorUserWhitelistCount[msg.sender] += 1;
                sponsorUserWhitelistEntries[msg.sender].push(user);
                sponsorUserWhitelistIndexPlusOne[msg.sender][user] =
                    sponsorUserWhitelistEntries[msg.sender].length;
            } else if (!allowed && current) {
                sponsorUserWhitelist[msg.sender][user] = false;
                sponsorUserWhitelistCount[msg.sender] -= 1;
                _removeSponsorUserWhitelistEntry(msg.sender, user);
            }

            emit SponsorUserWhitelistUpdated(msg.sender, user, allowed);
        }
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

    function canSponsorFor(
        address sponsorAddress,
        address targetContractAddress,
        address ownerAddress,
        address eoaAddress
    ) external view returns (bool) {
        SponsorInfo memory sponsor = sponsors[sponsorAddress];
        if (!sponsor.isActive) {
            return false;
        }
        
        SponsorRules memory rules = sponsorRules[sponsorAddress];
        if (rules.dailyLimit != 0) {
            uint256 today = block.timestamp / 1 days;
            uint256 lastReset = sponsorDailyReset[sponsorAddress];
            if (lastReset >= today && sponsorDailyCount[sponsorAddress] >= rules.dailyLimit) {
                return false;
            }
        }
        if (!_isSponsorContractAllowed(sponsorAddress, targetContractAddress)) {
            return false;
        }
        return _isSponsorUserAllowed(sponsorAddress, ownerAddress, eoaAddress);
    }

    function getSponsorContractWhitelist(address sponsorAddress)
        external
        view
        returns (address[] memory)
    {
        return sponsorContractWhitelistEntries[sponsorAddress];
    }

    function getSponsorUserWhitelist(address sponsorAddress)
        external
        view
        returns (address[] memory)
    {
        return sponsorUserWhitelistEntries[sponsorAddress];
    }

    function getSponsorApplicationCount(address sponsorAddress)
        external
        view
        returns (uint256)
    {
        return sponsorApplicationIds[sponsorAddress].length;
    }

    function getSponsorApplicationIds(
        address sponsorAddress,
        uint256 offset,
        uint256 limit
    ) external view returns (string[] memory) {
        uint256 total = sponsorApplicationIds[sponsorAddress].length;
        if (offset >= total || limit == 0) {
            return new string[](0);
        }

        uint256 endExclusive = offset + limit;
        if (endExclusive > total) {
            endExclusive = total;
        }
        uint256 resultLength = endExclusive - offset;
        string[] memory result = new string[](resultLength);

        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = sponsorApplicationIds[sponsorAddress][offset + i];
        }

        return result;
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

    function _requireSponsorEligible(
        address sponsorAddress,
        address targetContractAddress,
        address ownerAddress,
        address eoaAddress
    ) internal view {
        require(
            _isSponsorContractAllowed(sponsorAddress, targetContractAddress),
            "Sponsor contract whitelist check failed"
        );
        require(
            _isSponsorUserAllowed(sponsorAddress, ownerAddress, eoaAddress),
            "Sponsor user whitelist check failed"
        );
    }

    function _storeApplication(
        string memory applicationId,
        address accountAddress,
        address ownerAddress,
        address eoaAddress,
        address sponsorId,
        address targetContractAddress,
        uint256 chainId,
        string memory storageIdentifier,
        StorageProviderType storageType
    ) internal {
        ApplicationIndex storage app = applications[applicationId];
        app.applicationId = applicationId;
        app.accountAddress = accountAddress;
        app.ownerAddress = ownerAddress;
        app.eoaAddress = eoaAddress;
        app.sponsorId = sponsorId;
        app.targetContractAddress = targetContractAddress;
        app.chainId = chainId;
        app.storageIdentifier = storageIdentifier;
        app.storageType = storageType;
        app.status = ApplicationStatus.PENDING;
        app.reviewStorageIdentifier = "";
        app.createdAt = block.timestamp;
        app.reviewedAt = 0;
        app.deployedAt = 0;
    }

    function _removeSponsorContractWhitelistEntry(address sponsorAddress, address target) internal {
        uint256 indexPlusOne = sponsorContractWhitelistIndexPlusOne[sponsorAddress][target];
        if (indexPlusOne == 0) {
            return;
        }

        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = sponsorContractWhitelistEntries[sponsorAddress].length - 1;
        if (index != lastIndex) {
            address lastValue = sponsorContractWhitelistEntries[sponsorAddress][lastIndex];
            sponsorContractWhitelistEntries[sponsorAddress][index] = lastValue;
            sponsorContractWhitelistIndexPlusOne[sponsorAddress][lastValue] = index + 1;
        }
        sponsorContractWhitelistEntries[sponsorAddress].pop();
        sponsorContractWhitelistIndexPlusOne[sponsorAddress][target] = 0;
    }

    function _removeSponsorUserWhitelistEntry(address sponsorAddress, address user) internal {
        uint256 indexPlusOne = sponsorUserWhitelistIndexPlusOne[sponsorAddress][user];
        if (indexPlusOne == 0) {
            return;
        }

        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = sponsorUserWhitelistEntries[sponsorAddress].length - 1;
        if (index != lastIndex) {
            address lastValue = sponsorUserWhitelistEntries[sponsorAddress][lastIndex];
            sponsorUserWhitelistEntries[sponsorAddress][index] = lastValue;
            sponsorUserWhitelistIndexPlusOne[sponsorAddress][lastValue] = index + 1;
        }
        sponsorUserWhitelistEntries[sponsorAddress].pop();
        sponsorUserWhitelistIndexPlusOne[sponsorAddress][user] = 0;
    }

    function _isSponsorContractAllowed(address sponsorAddress, address targetContractAddress)
        internal
        view
        returns (bool)
    {
        if (sponsorContractWhitelistCount[sponsorAddress] == 0) {
            return true;
        }
        if (targetContractAddress == address(0)) {
            return false;
        }
        return sponsorContractWhitelist[sponsorAddress][targetContractAddress];
    }

    function _isSponsorUserAllowed(address sponsorAddress, address ownerAddress, address eoaAddress)
        internal
        view
        returns (bool)
    {
        if (sponsorUserWhitelistCount[sponsorAddress] == 0) {
            return true;
        }
        if (sponsorUserWhitelist[sponsorAddress][ownerAddress]) {
            return true;
        }
        if (eoaAddress != address(0) && sponsorUserWhitelist[sponsorAddress][eoaAddress]) {
            return true;
        }
        return false;
    }
}

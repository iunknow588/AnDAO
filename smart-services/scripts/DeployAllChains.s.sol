pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "src/Kernel.sol";
import "src/factory/KernelFactory.sol";
import "src/validator/MultiChainValidator.sol";

/**
 * @title DeployAllChains
 * @notice 多链批量部署脚本
 * 
 * @dev 此脚本用于批量部署合约到多个链
 * 
 * @dev 支持的链：
 * - Mantle Sepolia Testnet (Chain ID: 5003)
 * - Mantle Mainnet (Chain ID: 5000)
 * - Injective Testnet (Chain ID: 1439) - EVM 兼容
 * - Injective Mainnet (Chain ID: 1776) - EVM 兼容
 * 
 * @dev 使用方式：
 * 1. 部署到单个链：
 *    forge script scripts/DeployAllChains.s.sol:DeployAllChains --rpc-url mantle_sepolia --broadcast --private-key $PRIVATE_KEY -vvvv
 * 
 * 2. 批量部署到所有链（需要手动切换 RPC）：
 *    - 先部署到 Mantle Sepolia
 *    - 再部署到 Mantle Mainnet
 *    - 再部署到 Injective Testnet
 *    - 最后部署到 Injective Mainnet
 * 
 * @dev 注意事项：
 * - EntryPoint 地址在不同链上可能不同，需要根据实际情况调整
 * - ERC-4337 EntryPoint v0.6.0 标准地址通常是：0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
 * - 部署前需要确保账户有足够的 Gas 代币
 * - 部署后需要记录合约地址到 多链部署地址记录.md
 */
contract DeployAllChains is Script {
    // ERC-4337 EntryPoint 地址
    // v0.6.0 标准地址（大多数链使用）
    address constant ENTRYPOINT_V0_6 = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
    // v0.7 地址（某些链可能使用）
    address constant ENTRYPOINT_V0_7 = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    
    struct DeploymentResult {
        uint256 chainId;
        address kernel;
        address factory;
        address validator;
    }
    
    DeploymentResult[] public deployments;
    
    /**
     * @notice 主部署函数
     * @dev 部署 Kernel、KernelFactory 和 MultiChainValidator 到当前 RPC 网络
     */
    function run() external {
        uint256 chainId = block.chainid;
        console.log("=== Deploying to Chain ID:", chainId, "===");
        
        vm.startBroadcast();
        
        // 根据链选择 EntryPoint 地址
        // 默认使用 v0.6.0，如果需要使用 v0.7，可以修改此函数
        address entryPointAddress = getEntryPointForChain(chainId);
        console.log("Using EntryPoint:", entryPointAddress);
        
        // 部署 Kernel
        IEntryPoint entryPoint = IEntryPoint(entryPointAddress);
        Kernel kernel = new Kernel{salt: 0}(entryPoint);
        console.log("Kernel deployed at:", address(kernel));
        
        // 部署 KernelFactory
        KernelFactory factory = new KernelFactory{salt: 0}(address(kernel));
        console.log("KernelFactory deployed at:", address(factory));
        
        // 部署 MultiChainValidator
        MultiChainValidator validator = new MultiChainValidator{salt: 0}();
        console.log("MultiChainValidator deployed at:", address(validator));
        
        deployments.push(DeploymentResult({
            chainId: chainId,
            kernel: address(kernel),
            factory: address(factory),
            validator: address(validator)
        }));
        
        vm.stopBroadcast();
        
        // 输出部署摘要
        console.log("\n=== Deployment Summary ===");
        console.log("Chain ID:", chainId);
        console.log("Kernel:", address(kernel));
        console.log("KernelFactory:", address(factory));
        console.log("MultiChainValidator:", address(validator));
        console.log("\nPlease update docs/deployment-addresses.md with these addresses.");
    }
    
    /**
     * @notice 部署到指定链（辅助函数）
     * @dev 可以通过 fork 方式部署到不同链
     */
    function deployToChain(uint256 chainId, string memory rpcUrl) external {
        // 创建 fork
        vm.createSelectFork(rpcUrl);
        
        // 执行部署
        this.run();
    }
    
    /**
     * @notice 根据链 ID 获取 EntryPoint 地址
     * @dev 默认使用 v0.6.0 标准地址，某些链可能需要使用 v0.7
     * @param chainId 链 ID
     * @return EntryPoint 合约地址
     */
    function getEntryPointForChain(uint256 chainId) internal pure returns (address) {
        // Mantle 主网和测试网使用 v0.6.0
        if (chainId == 5000 || chainId == 5003) {
            return ENTRYPOINT_V0_6;
        }
        // Injective 使用 v0.6.0（如果支持 ERC-4337）
        if (chainId == 1776 || chainId == 1439) {
            return ENTRYPOINT_V0_6;
        }
        // 默认使用 v0.6.0
        return ENTRYPOINT_V0_6;
    }
}

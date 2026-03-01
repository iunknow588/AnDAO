pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "src/validator/MultiChainValidator.sol";

/**
 * @title DeployMultiChainValidator
 * @notice 单独部署 MultiChainValidator 合约
 * 
 * @dev 此脚本用于单独部署 MultiChainValidator 到指定链
 * 适用于已经部署了 Kernel 和 KernelFactory，只需要部署 MultiChainValidator 的场景
 * 
 * @dev 支持的链：
 * - Avalanche Fuji Testnet (Chain ID: 43113)
 * - Avalanche Mainnet (Chain ID: 43114)
 * - Mantle Sepolia Testnet (Chain ID: 5003)
 * - Mantle Mainnet (Chain ID: 5000)
 * - Injective Testnet (Chain ID: 1439) - EVM 兼容
 * - Injective Mainnet (Chain ID: 1776) - EVM 兼容
 * 
 * @dev 使用方式：
 * 1. 部署到单个链：
 *    forge script scripts/DeployMultiChainValidator.s.sol:DeployMultiChainValidator \
 *      --rpc-url mantle_sepolia \
 *      --broadcast \
 *      --private-key $PRIVATE_KEY \
 *      --verify \
 *      -vvvv
 * 
 * @dev 注意事项：
 * - 部署前需要确保账户有足够的 Gas 代币
 * - 部署后需要记录合约地址到 多链部署地址记录.md
 * - 部署后需要更新 .env.local 中的 VITE_*_MULTI_CHAIN_VALIDATOR_ADDRESS
 */
contract DeployMultiChainValidator is Script {
    
    /**
     * @notice 主部署函数
     * @dev 部署 MultiChainValidator 到当前 RPC 网络
     */
    function run() external {
        uint256 chainId = block.chainid;
        console.log("=== Deploying MultiChainValidator to Chain ID:", chainId, "===");
        
        vm.startBroadcast();
        
        // 部署 MultiChainValidator（使用普通部署，不使用 CREATE2，避免地址冲突）
        MultiChainValidator validator = new MultiChainValidator();
        console.log("MultiChainValidator deployed at:", address(validator));
        
        vm.stopBroadcast();
        
        // 输出部署摘要
        console.log("\n=== Deployment Summary ===");
        console.log("Chain ID:", chainId);
        console.log("MultiChainValidator:", address(validator));
        console.log("\nPlease update the following:");
        console.log("1. Update docs/deployment-addresses.md with the MultiChainValidator address");
        console.log("2. Update .env.local with VITE_*_MULTI_CHAIN_VALIDATOR_ADDRESS=", address(validator));
        console.log("3. Restart the dev server if it's running");
    }
}

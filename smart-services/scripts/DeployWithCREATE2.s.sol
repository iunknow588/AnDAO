pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "src/Kernel.sol";
import "src/factory/KernelFactory.sol";
import "src/validator/MultiChainValidator.sol";

/**
 * @title DeployWithCREATE2
 * @notice 使用 CREATE2_PROXY 部署到固定地址（类似 kernel-dev 的方式）
 * 
 * @dev 此脚本使用 CREATE2_PROXY 部署合约到固定地址，使得所有链上的合约地址相同
 * 
 * @dev 关键地址（与 kernel-dev 保持一致）：
 * - CREATE2_PROXY: 0x4e59b44847b379578588920cA78FbF26c0B4956C
 * - EXPECTED_KERNEL: 0x94F097E1ebEB4ecA3AAE54cabb08905B239A7D27
 * - EXPECTED_FACTORY: 0x6723b44Abeec4E71eBE3232BD5B455805baDD22f
 * 
 * @dev 使用方式：
 * 1. 先编译合约获取 bytecode：
 *    forge build
 * 
 * 2. 部署到单个链：
 *    forge script scripts/DeployWithCREATE2.s.sol:DeployWithCREATE2 \
 *      --rpc-url mantle_sepolia \
 *      --broadcast \
 *      --private-key $PRIVATE_KEY \
 *      -vvvv
 * 
 * @dev 注意事项：
 * - 需要先编译合约，然后从编译产物中获取 bytecode
 * - CREATE2_PROXY 必须在目标链上存在
 * - 如果预期地址已被占用，部署会失败
 * - EntryPoint 地址需要根据链选择（v0.6.0 或 v0.7）
 */
contract DeployWithCREATE2 is Script {
    // CREATE2_PROXY 地址（与 kernel-dev 相同）
    address constant CREATE2_PROXY = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    
    // kernel-dev 的预期地址（v3.0）
    address constant EXPECTED_KERNEL = 0x94F097E1ebEB4ecA3AAE54cabb08905B239A7D27;
    address constant EXPECTED_FACTORY = 0x6723b44Abeec4E71eBE3232BD5B455805baDD22f;
    
    // EntryPoint 地址（根据链选择）
    address constant ENTRYPOINT_V0_6 = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
    address constant ENTRYPOINT_V0_7 = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    
    /**
     * @notice 主部署函数
     * @dev 使用 CREATE2_PROXY 部署到预期地址
     * 
     * @dev 注意：此脚本需要先编译合约获取 bytecode
     * 实际部署时，需要从编译产物中获取 bytecode 并替换下面的占位符
     */
    function run() external {
        uint256 chainId = block.chainid;
        console.log("=== Deploying with CREATE2_PROXY to Chain ID:", chainId, "===");
        
        vm.startBroadcast();
        
        // 选择 EntryPoint 地址
        address entryPointAddress = getEntryPointForChain(chainId);
        console.log("Using EntryPoint:", entryPointAddress);
        
        // 1. 部署 Kernel（如果未部署）
        Kernel kernel = Kernel(payable(EXPECTED_KERNEL));
        if (EXPECTED_KERNEL.code.length == 0) {
            console.log("Kernel needs to be deployed via CREATE2_PROXY");
            console.log("Expected address:", EXPECTED_KERNEL);
            
            // 注意：这里需要实际的 bytecode
            // 实际使用时，需要从编译产物中获取 Kernel 的 bytecode
            // bytes memory kernelBytecode = ...; // 从 forge inspect Kernel bytecode 获取
            // (bool success,) = CREATE2_PROXY.call(kernelBytecode);
            // require(success, "Failed to deploy Kernel via CREATE2_PROXY");
            
            console.log("WARNING: Kernel bytecode not provided. Please:");
            console.log("   1. Run: forge build");
            console.log("   2. Run: forge inspect Kernel bytecode");
            console.log("   3. Update this script with the bytecode");
        } else {
            console.log("Kernel already deployed at:", address(kernel));
        }
        
        // 2. 部署 KernelFactory（如果未部署）
        KernelFactory factory = KernelFactory(EXPECTED_FACTORY);
        if (EXPECTED_FACTORY.code.length == 0) {
            console.log("Factory needs to be deployed via CREATE2_PROXY");
            console.log("Expected address:", EXPECTED_FACTORY);
            
            // 注意：Factory 需要 Kernel 地址作为构造函数参数
            // 实际使用时，需要构造包含构造函数参数的 bytecode
            // bytes memory factoryBytecode = ...; // 需要包含 EXPECTED_KERNEL 作为构造函数参数
            // (bool success,) = CREATE2_PROXY.call(factoryBytecode);
            // require(success, "Failed to deploy Factory via CREATE2_PROXY");
            
            console.log("WARNING: Factory bytecode not provided. Please:");
            console.log("   1. Run: forge build");
            console.log("   2. Run: forge inspect KernelFactory bytecode");
            console.log("   3. Update this script with the bytecode (including constructor args)");
        } else {
            console.log("Factory already deployed at:", address(factory));
            // 验证 Factory 的 implementation 是否正确
            if (factory.implementation() != EXPECTED_KERNEL) {
                console.log("WARNING: Factory implementation mismatch!");
                console.log("   Expected:", EXPECTED_KERNEL);
                console.log("   Actual:", factory.implementation());
            }
        }
        
        // 3. 部署 MultiChainValidator（如果未部署）
        // 注意：MultiChainValidator 没有构造函数参数，可以直接部署
        // 但需要计算预期地址（使用 CREATE2 salt）
        // 这里暂时不部署 MultiChainValidator，因为需要计算预期地址
        
        vm.stopBroadcast();
        
        console.log("\n=== Deployment Summary ===");
        console.log("Chain ID:", chainId);
        console.log("Kernel:", EXPECTED_KERNEL);
        console.log("Factory:", EXPECTED_FACTORY);
        console.log("\nIf contracts are deployed, update frontend config with these addresses.");
        console.log("If contracts are not deployed, update this script with bytecode and redeploy.");
    }
    
    /**
     * @notice 根据链 ID 获取 EntryPoint 地址
     */
    function getEntryPointForChain(uint256 chainId) internal pure returns (address) {
        // Avalanche 主网和 Fuji 测试网使用 v0.6.0
        if (chainId == 43114 || chainId == 43113) {
            return ENTRYPOINT_V0_6;
        }
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
    
    /**
     * @notice 检查 CREATE2_PROXY 是否可用
     * @dev 在部署前检查 CREATE2_PROXY 是否存在
     */
    function checkCREATE2Proxy() external view {
        if (CREATE2_PROXY.code.length == 0) {
            console.log("CREATE2_PROXY not found at:", CREATE2_PROXY);
            console.log("   This chain may not support CREATE2_PROXY.");
        } else {
            console.log("CREATE2_PROXY found at:", CREATE2_PROXY);
        }
    }
}

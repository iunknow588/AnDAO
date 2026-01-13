# 合约部署总结

## 部署网络
- **网络**: Mantle Sepolia 测试网
- **Chain ID**: 5003
- **RPC URL**: https://rpc.sepolia.mantle.xyz
- **Explorer**: https://sepolia.mantlescan.xyz/

## 已部署的合约

### 核心合约

#### 1. Kernel
- **地址**: `0x7318DdE98c8C70b4652b0C697d8Ee8E2e2d0655F`
- **状态**: ✅ 已部署
- **Explorer**: https://sepolia.mantlescan.xyz/address/0x7318DdE98c8C70b4652b0C697d8Ee8E2e2d0655F
- **说明**: 核心账户合约实现

#### 2. KernelFactory
- **地址**: `0x5401b77d3b9BB2ce8757951d03aB6d9aEb22161d`
- **状态**: ✅ 已部署
- **Explorer**: https://sepolia.mantlescan.xyz/address/0x5401b77d3b9BB2ce8757951d03aB6d9aEb22161d
- **说明**: Kernel 工厂合约，用于创建新账户

## 待部署的合约

### 验证器合约

#### ECDSAValidator
- **状态**: ⏳ 待部署
- **部署命令**:
  ```bash
  cd smart-services
  source .env
  forge script scripts/DeployECDSA.s.sol:DeployValidators \
    --rpc-url mantle_sepolia \
    --broadcast \
    --private-key $PRIVATE_KEY \
    -vvv
  ```

## 部署信息

- **部署账户**: `0xF9C5525792dF4D70C287b872BeA21C2E44df87Ac`
- **部署时间**: 2025-01-13
- **部署脚本**: `scripts/DeployKernel.s.sol`

## 注意事项

1. **FactoryStaker 授权**: 
   - FactoryStaker 的授权需要特定权限，可能需要单独处理
   - 如果需要使用 FactoryStaker，需要确保有正确的权限

2. **合约验证**:
   - 如果配置了 `ETHERSCAN_API_KEY`，可以在部署时使用 `--verify` 参数
   - 或者稍后在 Mantlescan 上手动验证合约代码

3. **前端配置**:
   - 需要在前端配置文件中更新这些合约地址
   - Kernel: `0x7318DdE98c8C70b4652b0C697d8Ee8E2e2d0655F`
   - KernelFactory: `0x5401b77d3b9BB2ce8757951d03aB6d9aEb22161d`

## 下一步

1. 部署 ECDSAValidator（如果需要）
2. 更新前端配置中的合约地址
3. 测试合约功能
4. 如果需要，部署到 Mantle 主网

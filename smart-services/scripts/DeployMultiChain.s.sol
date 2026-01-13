pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "src/validator/MultiChainValidator.sol";

contract DeployMultiChain is Script {
    // 使用方式:
    // 1. 使用私钥: forge script --broadcast --private-key $PRIVATE_KEY
    // 2. 使用地址: forge script --broadcast --sender $DEPLOYER_ADDRESS
    // 如果使用 --private-key，vm.startBroadcast() 会自动从参数获取私钥
    // 如果使用 --sender，需要确保账户已解锁或使用其他方式签名

    function run() external {
        // 使用 --private-key 参数时，不带参数调用会自动读取
        // 或者使用 --sender 参数指定发送者地址
        vm.startBroadcast();
        MultiChainValidator validator = new MultiChainValidator{salt: 0}();
        console.log("MultiChainValidator deployed at:", address(validator));
        vm.stopBroadcast();
    }
}

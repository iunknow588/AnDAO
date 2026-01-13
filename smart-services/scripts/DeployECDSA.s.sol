pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "src/validator/ECDSAValidator.sol";

contract DeployValidators is Script {
    function run() external {
        // 使用 --private-key 参数时，不带参数调用会自动读取
        vm.startBroadcast();
        ECDSAValidator validator = new ECDSAValidator{salt: 0}();
        console.log("ECDSA :", address(validator));
        vm.stopBroadcast();
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {ApplicationRegistry} from "../contracts/src/ApplicationRegistry.sol";

/**
 * @title DeployApplicationRegistry
 * @notice 部署ApplicationRegistry合约的脚本
 */
contract DeployApplicationRegistry is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        // 部署ApplicationRegistry合约
        ApplicationRegistry registry = new ApplicationRegistry();
        
        console.log("ApplicationRegistry deployed at:", address(registry));
        
        vm.stopBroadcast();
    }
}

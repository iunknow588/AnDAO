pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "src/Kernel.sol";

import "src/factory/KernelFactory.sol";
import "src/factory/FactoryStaker.sol";

contract DeployValidators is Script {
    address constant ENTRYPOINT_0_7_ADDR = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    address constant EXPECTED_STAKER = 0xd703aaE79538628d27099B8c4f621bE4CCd142d5;

    function run() external {
        // 使用 --private-key 参数时，不带参数调用会自动读取
        vm.startBroadcast();
        Kernel kernel = new Kernel{salt: 0}(IEntryPoint(ENTRYPOINT_0_7_ADDR));
        console.log("Kernel : ", address(kernel));
        KernelFactory factory = new KernelFactory{salt: 0}(address(kernel));
        console.log("KernelFactory : ", address(factory));
        
        // 注意：FactoryStaker 的授权需要特定的权限，可能需要单独处理
        // FactoryStaker staker = FactoryStaker(EXPECTED_STAKER);
        // if (!staker.approved(factory)) {
        //     staker.approveFactory(factory, true);
        //     console.log("Approved");
        // }
        
        vm.stopBroadcast();
    }
}

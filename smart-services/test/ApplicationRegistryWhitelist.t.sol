// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ApplicationRegistry} from "../contracts/src/ApplicationRegistry.sol";

contract ApplicationRegistryWhitelistTest is Test {
    ApplicationRegistry internal registry;

    address internal sponsor = address(0xA11CE);
    address internal gasAccount = address(0xB0B);
    address internal owner = address(0xC0DE);
    address internal eoa = address(0xD00D);
    address internal accountAddress = address(0xE001);
    address internal allowedContract = address(0xF001);
    address internal blockedContract = address(0xF002);

    function setUp() public {
        registry = new ApplicationRegistry();

        vm.prank(sponsor);
        registry.registerSponsor(
            sponsor,
            gasAccount,
            "Whitelist Sponsor",
            "for whitelist tests",
            ApplicationRegistry.StorageProviderType.IPFS
        );

        vm.prank(sponsor);
        registry.updateSponsorRules(100, 1 ether, false);
    }

    function test_registerApplication_reverts_whenTargetContractNotAllowed() public {
        address[] memory contracts = new address[](1);
        contracts[0] = allowedContract;
        vm.prank(sponsor);
        registry.setSponsorContractWhitelist(contracts, true);

        vm.expectRevert(bytes("Sponsor contract whitelist check failed"));
        registry.registerApplication(
            ApplicationRegistry.RegisterApplicationInput({
                applicationId: "app-1",
                accountAddress: accountAddress,
                ownerAddress: owner,
                eoaAddress: eoa,
                sponsorId: sponsor,
                targetContractAddress: blockedContract,
                chainId: 43113,
                storageIdentifier: "ipfs://app-1",
                storageType: ApplicationRegistry.StorageProviderType.IPFS
            })
        );
    }

    function test_registerApplication_reverts_whenUserNotWhitelisted() public {
        address[] memory users = new address[](1);
        users[0] = address(0x123456);
        vm.prank(sponsor);
        registry.setSponsorUserWhitelist(users, true);

        vm.expectRevert(bytes("Sponsor user whitelist check failed"));
        registry.registerApplication(
            ApplicationRegistry.RegisterApplicationInput({
                applicationId: "app-2",
                accountAddress: accountAddress,
                ownerAddress: owner,
                eoaAddress: eoa,
                sponsorId: sponsor,
                targetContractAddress: allowedContract,
                chainId: 43113,
                storageIdentifier: "ipfs://app-2",
                storageType: ApplicationRegistry.StorageProviderType.IPFS
            })
        );
    }

    function test_registerApplication_succeeds_whenContractAndUserAllowed() public {
        address[] memory contracts = new address[](1);
        contracts[0] = allowedContract;
        vm.prank(sponsor);
        registry.setSponsorContractWhitelist(contracts, true);

        address[] memory users = new address[](2);
        users[0] = owner;
        users[1] = eoa;
        vm.prank(sponsor);
        registry.setSponsorUserWhitelist(users, true);

        registry.registerApplication(
            ApplicationRegistry.RegisterApplicationInput({
                applicationId: "app-3",
                accountAddress: accountAddress,
                ownerAddress: owner,
                eoaAddress: eoa,
                sponsorId: sponsor,
                targetContractAddress: allowedContract,
                chainId: 43113,
                storageIdentifier: "ipfs://app-3",
                storageType: ApplicationRegistry.StorageProviderType.IPFS
            })
        );

        ApplicationRegistry.ApplicationIndex memory app = registry.getApplication("app-3");
        assertEq(app.sponsorId, sponsor);
        assertEq(app.ownerAddress, owner);
        assertEq(app.targetContractAddress, allowedContract);
    }

    function test_canSponsorFor_followsWhitelistRules() public {
        address[] memory contracts = new address[](1);
        contracts[0] = allowedContract;
        vm.prank(sponsor);
        registry.setSponsorContractWhitelist(contracts, true);

        address[] memory users = new address[](1);
        users[0] = owner;
        vm.prank(sponsor);
        registry.setSponsorUserWhitelist(users, true);

        bool ok = registry.canSponsorFor(sponsor, allowedContract, owner, eoa);
        bool blockedByContract = registry.canSponsorFor(sponsor, blockedContract, owner, eoa);
        bool blockedByUser = registry.canSponsorFor(sponsor, allowedContract, address(0x9999), eoa);

        assertTrue(ok);
        assertFalse(blockedByContract);
        assertFalse(blockedByUser);
    }

    function test_getSponsorApplicationIds_returns_paginated_ids() public {
        registry.registerApplication(
            ApplicationRegistry.RegisterApplicationInput({
                applicationId: "app-list-1",
                accountAddress: accountAddress,
                ownerAddress: owner,
                eoaAddress: eoa,
                sponsorId: sponsor,
                targetContractAddress: address(0),
                chainId: 43113,
                storageIdentifier: "ipfs://app-list-1",
                storageType: ApplicationRegistry.StorageProviderType.IPFS
            })
        );

        registry.registerApplication(
            ApplicationRegistry.RegisterApplicationInput({
                applicationId: "app-list-2",
                accountAddress: address(0xE002),
                ownerAddress: owner,
                eoaAddress: eoa,
                sponsorId: sponsor,
                targetContractAddress: address(0),
                chainId: 43113,
                storageIdentifier: "ipfs://app-list-2",
                storageType: ApplicationRegistry.StorageProviderType.IPFS
            })
        );

        uint256 total = registry.getSponsorApplicationCount(sponsor);
        assertEq(total, 2);

        string[] memory firstPage = registry.getSponsorApplicationIds(sponsor, 0, 1);
        assertEq(firstPage.length, 1);
        assertEq(firstPage[0], "app-list-1");

        string[] memory secondPage = registry.getSponsorApplicationIds(sponsor, 1, 10);
        assertEq(secondPage.length, 1);
        assertEq(secondPage[0], "app-list-2");
    }

    function test_whitelist_getters_return_latest_entries() public {
        address[] memory contracts = new address[](2);
        contracts[0] = allowedContract;
        contracts[1] = blockedContract;
        vm.prank(sponsor);
        registry.setSponsorContractWhitelist(contracts, true);

        address[] memory users = new address[](2);
        users[0] = owner;
        users[1] = eoa;
        vm.prank(sponsor);
        registry.setSponsorUserWhitelist(users, true);

        vm.prank(sponsor);
        address[] memory removeContracts = new address[](1);
        removeContracts[0] = blockedContract;
        registry.setSponsorContractWhitelist(removeContracts, false);

        address[] memory contractList = registry.getSponsorContractWhitelist(sponsor);
        address[] memory userList = registry.getSponsorUserWhitelist(sponsor);

        assertEq(contractList.length, 1);
        assertEq(contractList[0], allowedContract);
        assertEq(userList.length, 2);
    }
}

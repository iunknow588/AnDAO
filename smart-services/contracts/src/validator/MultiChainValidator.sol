// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {ECDSA} from "solady/utils/ECDSA.sol";
import {MerkleProofLib} from "solady/utils/MerkleProofLib.sol";
import {IValidator, IHook} from "../interfaces/IERC7579Modules.sol";
import {PackedUserOperation} from "../interfaces/PackedUserOperation.sol";
import {
    SIG_VALIDATION_SUCCESS_UINT,
    SIG_VALIDATION_FAILED_UINT,
    MODULE_TYPE_VALIDATOR,
    MODULE_TYPE_HOOK,
    ERC1271_MAGICVALUE,
    ERC1271_INVALID
} from "../types/Constants.sol";

struct ECDSAValidatorStorage {
    address owner;
}

bytes constant DUMMY_ECDSA_SIG =
    hex"fffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c";

/**
 * @title MultiChainValidator
 * @notice ECDSA 验证器，支持 Merkle Proof 验证（可用于跨链场景）
 * 
 * @dev 重要说明：
 * - 合约名称中的 "MultiChain" 指的是支持 Merkle Proof 验证机制，可以用于跨链验证场景
 * - 但合约本身在每个链上独立部署，每个部署实例只存储当前链的 owner 地址
 * - 实际的多链支持通过以下方式实现：
 *   1. 每个链上独立部署 MultiChainValidator 实例
 *   2. 使用 Merkle Proof 机制可以验证来自其他链的签名（需要外部服务生成 Merkle Tree）
 *   3. 每个链上的账户状态是独立的，不共享
 * 
 * @dev 存储结构：
 * - ecdsaValidatorStorage: 存储每个智能账户的 owner 地址（单链存储）
 * - 每个链上的 MultiChainValidator 实例管理该链上的账户验证
 * 
 * @dev Merkle Proof 支持：
 * - 支持标准 ECDSA 签名验证（65 bytes）
 * - 支持 Merkle Proof 验证（>65 bytes），可用于跨链验证场景
 * - Merkle Proof 需要外部服务生成和维护
 * 
 * @dev 部署说明：
 * - 需要在每个目标链上独立部署此合约
 * - 不同链上的部署地址可能不同（除非使用 CREATE2 确定性地址）
 * - 部署后需要在对应链的前端配置中更新地址
 */
contract MultiChainValidator is IValidator, IHook {
    event OwnerRegistered(address indexed kernel, address indexed owner);

    mapping(address => ECDSAValidatorStorage) public ecdsaValidatorStorage;

    function onInstall(bytes calldata _data) external payable override {
        address owner = address(bytes20(_data[0:20]));
        ecdsaValidatorStorage[msg.sender].owner = owner;
        emit OwnerRegistered(msg.sender, owner);
    }

    function onUninstall(bytes calldata) external payable override {
        if (!_isInitialized(msg.sender)) revert NotInitialized(msg.sender);
        delete ecdsaValidatorStorage[msg.sender];
    }

    function isModuleType(uint256 typeID) external pure override returns (bool) {
        return typeID == MODULE_TYPE_VALIDATOR || typeID == MODULE_TYPE_HOOK;
    }

    function isInitialized(address smartAccount) external view override returns (bool) {
        return _isInitialized(smartAccount);
    }

    function _isInitialized(address smartAccount) internal view returns (bool) {
        return ecdsaValidatorStorage[smartAccount].owner != address(0);
    }

    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash)
        external
        payable
        override
        returns (uint256)
    {
        bytes calldata sig = userOp.signature;
        address owner = ecdsaValidatorStorage[msg.sender].owner;
        if (sig.length == 65) {
            // simple ecdsa verification
            if (owner == ECDSA.recover(userOpHash, sig)) {
                return SIG_VALIDATION_SUCCESS_UINT;
            }
            bytes32 ethHash = ECDSA.toEthSignedMessageHash(userOpHash);
            address recovered = ECDSA.recover(ethHash, sig);
            if (owner != recovered) {
                return SIG_VALIDATION_FAILED_UINT;
            }
            return SIG_VALIDATION_SUCCESS_UINT;
        }
        bytes memory ecdsaSig = sig[0:65];
        bytes32 merkleRoot = bytes32(sig[65:97]);
        // if the signature is a dummy signature, then use dummyUserOpHash instead of real userOpHash
        if (keccak256(ecdsaSig) == keccak256(DUMMY_ECDSA_SIG)) {
            (bytes32 dummyUserOpHash, bytes32[] memory proof) = abi.decode(sig[97:], (bytes32, bytes32[]));
            require(MerkleProofLib.verify(proof, merkleRoot, dummyUserOpHash), "hash is not in proof");
            // otherwise, use real userOpHash
        } else {
            bytes32[] memory proof = abi.decode(sig[97:], (bytes32[]));
            require(MerkleProofLib.verify(proof, merkleRoot, userOpHash), "hash is not in proof");
        }
        // simple ecdsa verification
        if (owner == ECDSA.recover(merkleRoot, ecdsaSig)) {
            return SIG_VALIDATION_SUCCESS_UINT;
        }
        bytes32 ethRoot = ECDSA.toEthSignedMessageHash(merkleRoot);
        address merkleRecovered = ECDSA.recover(ethRoot, ecdsaSig);
        if (owner != merkleRecovered) {
            return SIG_VALIDATION_FAILED_UINT;
        }
        return SIG_VALIDATION_SUCCESS_UINT;
    }

    function isValidSignatureWithSender(address, bytes32 hash, bytes calldata sig)
        external
        view
        override
        returns (bytes4)
    {
        address owner = ecdsaValidatorStorage[msg.sender].owner;
        if (sig.length == 65) {
            // simple ecdsa verification
            if (owner == ECDSA.recover(hash, sig)) {
                return ERC1271_MAGICVALUE;
            }
            bytes32 ethHash = ECDSA.toEthSignedMessageHash(hash);
            address recovered = ECDSA.recover(ethHash, sig);
            if (owner != recovered) {
                return ERC1271_INVALID;
            }
            return ERC1271_MAGICVALUE;
        }
        bytes memory ecdsaSig = sig[0:65];
        bytes32 merkleRoot = bytes32(sig[65:97]);
        bytes32[] memory proof = abi.decode(sig[97:], (bytes32[]));
        require(MerkleProofLib.verify(proof, merkleRoot, hash), "hash is not in proof");
        // simple ecdsa verification
        if (owner == ECDSA.recover(merkleRoot, ecdsaSig)) {
            return ERC1271_MAGICVALUE;
        }
        bytes32 ethRoot = ECDSA.toEthSignedMessageHash(merkleRoot);
        address merkleRecovered = ECDSA.recover(ethRoot, ecdsaSig);
        if (owner != merkleRecovered) {
            return ERC1271_INVALID;
        }
        return ERC1271_MAGICVALUE;
    }

    function preCheck(address msgSender, uint256 value, bytes calldata)
        external
        payable
        override
        returns (bytes memory)
    {
        require(msgSender == ecdsaValidatorStorage[msg.sender].owner, "ECDSAValidator: sender is not owner");
        return hex"";
    }

    function postCheck(bytes calldata hookData) external payable override {}
}

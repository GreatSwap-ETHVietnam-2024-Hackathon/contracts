// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {BaseAuthorizationModule} from "../BaseAuthorizationModule.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@account-abstraction/contracts/core/Helpers.sol";
import {ISessionKeyManager} from "../../interfaces/ISessionKeyManager.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./SwapValidator.sol";
import "./PreApproveValidator.sol";
import "hardhat/console.sol";

interface ISmartAccount {
    function getOwner(address smartAccount) external view returns (address);
}

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
}

contract SwapSessionKeyManager is BaseAuthorizationModule, Ownable {
    address public ECDSA_MODULE_ADDRESS;
    address public WRAPPED_NATIVE_TOKEN;
    uint48 public constant FEE_RATE_PRECISION = 1e6;
    uint48 public FEE_RATE;
    address public FEE_RECIPIENT;

    constructor(
        address _ECDSA_MODULE_ADDRESS,
        address _WRAPPED_NATIVE_TOKEN,
        address _FEE_RECIPIENT,
        uint48 _FEE_RATE
    ) {
        ECDSA_MODULE_ADDRESS = _ECDSA_MODULE_ADDRESS;
        WRAPPED_NATIVE_TOKEN = _WRAPPED_NATIVE_TOKEN;
        require(
            _FEE_RATE < FEE_RATE_PRECISION,
            "Fee rate must be less than 100%"
        );
        FEE_RATE = _FEE_RATE;
        FEE_RECIPIENT = _FEE_RECIPIENT;
    }

    /**
     * @dev mapping of owner to a session root
     */
    mapping(address => bytes32) public merkleRoot;

    function setMerkleRoot(bytes32 _merkleRoot) external {
        merkleRoot[msg.sender] = _merkleRoot;
    }

    function setFeeRecipient(address _FEE_RECIPIENT) external onlyOwner {
        FEE_RECIPIENT = _FEE_RECIPIENT;
    }

    /**
     * @dev validates userOperation
     * @param userOp User Operation to be validated.
     * @param userOpHash Hash of the User Operation to be validated.
     * @return sigValidationResult 0 if signature is valid, SIG_VALIDATION_FAILED otherwise.
     */
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) external view virtual returns (uint256) {
        address sender = userOp.sender;

        address owner = ISmartAccount(ECDSA_MODULE_ADDRESS).getOwner(sender);

        (bytes memory moduleSignature, ) = abi.decode(
            userOp.signature,
            (bytes, address)
        );
        (
            uint48 validUntil,
            uint48 validAfter,
            address router,
            address token,
            address sessionKey,
            uint8 operation,
            bool approveAll,
            bytes32[] memory merkleProof,
            bytes memory sessionKeySignature
        ) = abi.decode(
                moduleSignature,
                (
                    uint48,
                    uint48,
                    address,
                    address,
                    address,
                    uint8,
                    bool,
                    bytes32[],
                    bytes
                )
            );

        if (operation == 0 || operation == 1) {
            require(
                token != address(0) && token != WRAPPED_NATIVE_TOKEN,
                "Specified token must be non-native"
            );

            uint256 amountIn;
            uint256 payment;

            if (operation == 0) {
                (amountIn, payment) = SwapValidator.validateBuy(
                    userOp,
                    token,
                    WRAPPED_NATIVE_TOKEN,
                    router,
                    FEE_RECIPIENT
                );
            } else {
                (amountIn, payment) = SwapValidator.validateSell(
                    userOp,
                    token,
                    WRAPPED_NATIVE_TOKEN,
                    router,
                    FEE_RECIPIENT
                );
            }

            // payment = (FEE_RATE / FEE_PRECISION) * sum
            // payment * FEE_PRECISION = sum * FEE_RATE
            uint256 lower =  payment * FEE_RATE_PRECISION;
            uint256 upper = (payment + 1) * FEE_RATE_PRECISION;
            uint256 target = (payment + amountIn) * FEE_RATE;

            require(
                target >= lower && target <= upper,
                "Wrong payment value"
            );
        } else {
            // approve
            PreApproveValidator.validatePreApprove(userOp, token, router);
        }

        bytes32 root = merkleRoot[owner];

        bytes32 leaf;
        if (!approveAll)
            leaf = keccak256(
                abi.encodePacked(
                    validUntil,
                    validAfter,
                    token,
                    sessionKey,
                    sender,
                    router
                )
            );
        else
            leaf = keccak256(
                abi.encodePacked(
                    validUntil,
                    validAfter,
                    sessionKey,
                    sender,
                    router
                )
            );
        if (!MerkleProof.verify(merkleProof, root, leaf)) {
            revert("SessionNotApproved");
        }

        bool validSig = ECDSA.recover(
            ECDSA.toEthSignedMessageHash(userOpHash),
            sessionKeySignature
        ) == sessionKey;

        return
            _packValidationData(
                //_packValidationData expects true if sig validation has failed, false otherwise
                !validSig,
                validUntil,
                validAfter
            );
    }

    function withdraw(address payable to) external onlyOwner {
        to.transfer(address(this).balance);
    }

    /**
     * @dev returns the SessionStorage object for a given owner
     * @param owner owner address
     */
    function getSessionRoot(address owner) external view returns (bytes32) {
        return merkleRoot[owner];
    }

    /**
     * @dev isValidSignature according to BaseAuthorizationModule
     * @param _dataHash Hash of the data to be validated.
     * @param _signature Signature over the the _dataHash.
     * @return always returns 0xffffffff as signing messages is not supported by SessionKeys
     */
    function isValidSignature(
        bytes32 _dataHash,
        bytes memory _signature
    ) public pure override returns (bytes4) {
        (_dataHash, _signature);
        return 0xffffffff; // do not support it here
    }
}

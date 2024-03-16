// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import "solidity-bytes-utils/contracts/BytesLib.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {UserOperation} from "@account-abstraction/contracts/interfaces/UserOperation.sol";

library PreApproveValidator {
    using BytesLib for bytes;

    bytes4 public constant ERC20_APPROVE_SELECTOR = 0x095ea7b3;
    // execute_ncC(address,uint256,bytes)
    bytes4 public constant EXECUTE_OPTIMIZED_SELECTOR = 0x0000189a;

    function validatePreApprove(
        UserOperation calldata op,
        address asset,
        address ROUTER
    ) internal pure{
        require(
            bytes4(op.callData.slice(0, 4)) == EXECUTE_OPTIMIZED_SELECTOR,
            "PV: Wrong function selector"
        );
        (address tokenAddress,, bytes memory data) = abi
            .decode(
                op.callData[4:], // skip selector
                (address, uint256, bytes)
            );
        if (tokenAddress != asset) {
            revert("PV: Wrong approved asset");
        }
        bytes4 fncSig = bytes4(data.slice(0, 4));

        require(
            fncSig == ERC20_APPROVE_SELECTOR,
            "PV: wrong function signature"
        );
        bytes memory funcData = data.slice(4, data.length - 4);

        (address routerAddr, ) = abi.decode(funcData, (address, uint256));
        require(routerAddr == ROUTER, "PV: can only approve router");
    }
}

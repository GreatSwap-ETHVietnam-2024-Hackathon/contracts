// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import "solidity-bytes-utils/contracts/BytesLib.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {UserOperation} from "@account-abstraction/contracts/interfaces/UserOperation.sol";

library SwapValidator {
    using BytesLib for bytes;

    struct UniV3ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    struct AlgebraExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    bytes4 public constant WRAP_ETH_SELECTOR = 0xd0e30db0;
    bytes4 public constant ERC20_APPROVE_SELECTOR = 0x095ea7b3;
    bytes4 public constant ERC20_TRANSFER_SELECTOR = 0xa9059cbb;

    bytes4 public constant UNIV3_EXACT_INPUT_SINGLE_SELECTOR = 0x414bf389;
    bytes4 public constant ALGEBRA_EXACT_INPUT_SINGLE_SELECTOR = 0xbc651188;
    bytes4 public constant POST_OP_CHECK_SELECTOR = 0xf746718e;

    // function executeBatch_y6U( address[] calldata dest, uint256[] calldata value, bytes[] calldata func)
    bytes4 public constant EXECUTE_BATCH_SELECTOR = 0x00004680;

    function validateBuy(
        UserOperation memory op,
        address token,
        address WRAPPED_NATIVE_TOKEN,
        address ROUTER,
        address FEE_RECIPIENT
    ) internal pure returns (uint256 amountIn, uint256 payment) {
        bytes4 opFncSig = bytes4(op.callData.slice(0, 4));

        require(
            opFncSig == EXECUTE_BATCH_SELECTOR,
            "SV: Invalid Op func signature"
        );

        bytes memory opData = op.callData.slice(4, op.callData.length - 4);

        (
            address[] memory addresses,
            uint256[] memory callValues,
            bytes[] memory data
        ) = abi.decode(opData, (address[], uint256[], bytes[]));

        require(
            addresses.length == callValues.length &&
                addresses.length == data.length,
            "SV: invalid tx list's length"
        );
        uint256 fncNum = addresses.length;
        require(fncNum >= 2 && fncNum <= 4, "SV: invalid number of txs");

        uint256 buyTxIndex = fncNum - 2;

        require(addresses[buyTxIndex] == ROUTER, "SV: invalid router");

        amountIn = validateSwapTx(
            data[buyTxIndex],
            op.sender,
            WRAPPED_NATIVE_TOKEN,
            token
        );

        uint256 paymentTxIndex = fncNum - 1;

        require(
            addresses[paymentTxIndex] == FEE_RECIPIENT,
            "SV: invalid payment recipient"
        );

        payment = callValues[paymentTxIndex];

        if (fncNum == 3) {
            require(callValues[buyTxIndex] == 0, "SV: invalid callvalue");
            require(
                addresses[0] == WRAPPED_NATIVE_TOKEN,
                "SV: must call the wrapped native"
            );
            bytes4 fncSig = bytes4(data[0].slice(0, 4));

            if (fncSig == ERC20_APPROVE_SELECTOR) {
                validateApproveTx(data[0], ROUTER);
            } else {
                require(
                    fncSig == WRAP_ETH_SELECTOR,
                    "SV: Invalid op funtion signature"
                );
            }
        } else if (fncNum == 4) {
            require(
                callValues[1] == 0 && callValues[2] == 0,
                "SV: invalid callvalue"
            );
            require(
                addresses[0] == WRAPPED_NATIVE_TOKEN &&
                    addresses[1] == WRAPPED_NATIVE_TOKEN,
                "SV: must call the wrapped native"
            );
            require(
                bytes4(data[0].slice(0, 4)) == WRAP_ETH_SELECTOR &&
                    bytes4(data[1].slice(0, 4)) == ERC20_APPROVE_SELECTOR,
                "SV: Invalid op funtion signature"
            );
            validateApproveTx(data[1], ROUTER);
        }
    }

    function validateSell(
        UserOperation memory op,
        address token,
        address WRAPPED_NATIVE_TOKEN,
        address ROUTER,
        address FEE_RECIPIENT
    ) internal pure returns (uint256 amountIn, uint256 payment) {
        bytes4 opFncSig = bytes4(op.callData.slice(0, 4));
        require(
            opFncSig == EXECUTE_BATCH_SELECTOR,
            "SV: Invalid Op func signature"
        );

        bytes memory opData = op.callData.slice(4, op.callData.length - 4);

        (
            address[] memory addresses,
            uint256[] memory callValues,
            bytes[] memory data
        ) = abi.decode(opData, (address[], uint256[], bytes[]));

        require(
            addresses.length == callValues.length &&
                addresses.length == data.length,
            "SV: invalid tx list's length"
        );
        uint256 fncNum = addresses.length;
        require(fncNum == 2 || fncNum == 3, "SV: invalid number of txs");

        uint256 sellTxIndex = fncNum - 2;

        require(addresses[sellTxIndex] == ROUTER, "SV: invalid router");
        amountIn = validateSwapTx(
            data[sellTxIndex],
            op.sender,
            token,
            WRAPPED_NATIVE_TOKEN
        );
        require(callValues[sellTxIndex] == 0, "SV: Invalid call value");

        uint256 paymentTxIndex = fncNum - 1;

        require(
            addresses[paymentTxIndex] == token,
            "SV: invalid payment token"
        );
        require(
            callValues[paymentTxIndex] == 0,
            "SV: no native payment allowed"
        );
        bytes memory paymentData = data[paymentTxIndex];
        bytes4 paymentFncSig = bytes4(paymentData.slice(0, 4));
        require(
            paymentFncSig == ERC20_TRANSFER_SELECTOR,
            "SV: invalid payment function"
        );
        bytes memory paymentParams = paymentData.slice(
            4,
            paymentData.length - 4
        );
        (address actualRecipient, uint256 actualPayment) = abi.decode(
            paymentParams,
            (address, uint256)
        );
        require(
            FEE_RECIPIENT == actualRecipient,
            "SV: invalid payment recipient"
        );
        payment = actualPayment;

        if (fncNum == 3) {
            require(addresses[0] == token, "SV: must approve token");

            bytes4 fncSig = bytes4(data[0].slice(0, 4));
            require(
                fncSig == ERC20_APPROVE_SELECTOR,
                "SV: Invalid op funtion signature"
            );

            bytes memory funcData = data[0].slice(4, data[0].length - 4);
            (address router, ) = abi.decode(funcData, (address, uint256));
            require(router == ROUTER, "SV: invalid spender");
        }
    }

    function validateSwapTx(
        bytes memory data,
        address sender,
        address tokenIn,
        address tokenOut
    ) internal pure returns (uint256 amountIn) {
        bytes4 fncSig = bytes4(data.slice(0, 4));

        bytes memory funcData = data.slice(4, data.length - 4);

        address actualTokenIn;
        address actualTokenOut;
        address actualRecipient;

        if (fncSig == UNIV3_EXACT_INPUT_SINGLE_SELECTOR) {
            UniV3ExactInputSingleParams memory params = abi.decode(
                funcData,
                (UniV3ExactInputSingleParams)
            );
            actualTokenIn = params.tokenIn;
            actualTokenOut = params.tokenOut;
            actualRecipient = params.recipient;
            amountIn = params.amountIn;
        } else if (fncSig == ALGEBRA_EXACT_INPUT_SINGLE_SELECTOR) {
            AlgebraExactInputSingleParams memory params = abi.decode(
                funcData,
                (AlgebraExactInputSingleParams)
            );
            actualTokenIn = params.tokenIn;
            actualTokenOut = params.tokenOut;
            actualRecipient = params.recipient;
            amountIn = params.amountIn;
        } else {
            revert("SV: Swap function is not supported");
        }

        require(actualTokenIn == tokenIn, "SV: Wrong token in");
        require(actualTokenOut == tokenOut, "SV: Wrong token out");
        require(actualRecipient == sender, "SV: Wrong recipient");
    }

    function validateApproveTx(
        bytes memory data,
        address ROUTER
    ) internal pure {
        bytes memory funcData = data.slice(4, data.length - 4);
        (address router, ) = abi.decode(funcData, (address, uint256));
        require(router == ROUTER, "SV: invalid spender");
    }
}

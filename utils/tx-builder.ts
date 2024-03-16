import { BigNumber, BigNumberish } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { defaultFeeRate, feeRecipient } from "./setupHelper";
import { WrappedETH__factory } from "../contract-types";
import { ISwapRouter as IUniV3SwapRouter } from "../contract-types/UniV3Router";
import { ISwapRouter as IAlgebraSwapRouter } from "../contract-types/AlgebraRouter";
import { UniV3Router__factory } from "../contract-types/factories/UniV3Router__factory";
import { AlgebraRouter__factory } from "../contract-types/factories/AlgebraRouter__factory";
import { ERC20__factory } from "../typechain-types";

export type Transaction = {
    to: string,
    value: BigNumberish,
    data: string
}

const WETHInterface = WrappedETH__factory.createInterface();
const UniV3RouterInterface = UniV3Router__factory.createInterface();
const AlgebraRouterInterface = AlgebraRouter__factory.createInterface();

export function calculatePaymentAndAmountIn(spentAmount: BigNumber) {
    const payment = spentAmount.mul(defaultFeeRate).div(1e6)
    const amountIn = spentAmount.sub(payment);
    return {payment, amountIn};
}
export function buildWrapETHTx(WETHAddress: string, amount: BigNumberish): Transaction {
    return {
        to: WETHAddress,
        value: amount,
        data: WETHInterface.encodeFunctionData("deposit")
    }
}
export function buildApprovalTx(tokenAddress: string, amount: BigNumberish, router: string): Transaction {
    return {
        data: ERC20__factory.createInterface().encodeFunctionData("approve", [router, amount]),
        to: tokenAddress,
        value: parseEther('0')
    }
}
export function buildBuyPaymentTx(
    payment: BigNumberish
): Transaction {
    return {
        to: feeRecipient,
        value: payment,
        data: '0x'
    }
}

export function buildSellPaymentTx(
    token: string,
    payment: BigNumberish
): Transaction {
    return {
        to: token,
        value: parseEther('0'),
        data: ERC20__factory.createInterface().encodeFunctionData("transfer", [feeRecipient, payment])
    }
}
export function buildUniV3ExactInputSingleTx(
    UniswapV3RouterAddress: string,
    callValue: BigNumber,
    params: IUniV3SwapRouter.ExactInputSingleParamsStruct
): Transaction {

    const calldata = UniV3RouterInterface.encodeFunctionData("exactInputSingle", [params])

    return {
        data: calldata,
        to: UniswapV3RouterAddress,
        value: callValue
    }
}
export function buildAlgebraExactInputSingleTx(
    CamelotV3RouterAddress: string,
    callValue: BigNumber,
    params: IAlgebraSwapRouter.ExactInputSingleParamsStruct
): Transaction {

    const calldata = AlgebraRouterInterface.encodeFunctionData("exactInputSingle", [params])

    return {
        data: calldata,
        to: CamelotV3RouterAddress,
        value: callValue
    }
}




import { ethers } from "hardhat";

import {
    ERC20__factory,
    EntryPoint__factory,
    IQuoterV2__factory,
    MockWrappedETH__factory,
    TokenPaymaster__factory,
} from "../../typechain-types";
import { WETH9 } from "@uniswap/sdk-core";
import { Wallet } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { weth_abi } from "../../abis/weth";

async function test() {
    const pancakeSwapQuote = "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997";

    const pankaceSwapRoute = "0x1b81D678ffb9C0263b24A97847620C99d213eB14";

    const quote = IQuoterV2__factory.connect(pancakeSwapQuote, ethers.provider);

    const paymaster = TokenPaymaster__factory.connect("0xA7544F5320d1fec58c829A7e0e19143173c3Dd05", ethers.provider);
    const WETHAddress = "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f";
    const LynexAddress = "0x0d1e753a25ebda689453309112904807625befbe";
    const OwnerPaymaster = new Wallet(process.env.PRIVATE_KEY_TOKEN_PAYMASTER!, ethers.provider);

    const encode = await paymaster.encodeFirstPool(LynexAddress, WETHAddress, 500);
    console.log(" encode = ", encode);
    // const result = await paymaster.connect(OwnerPaymaster).callStatic.estimatesTokenToToken(LynexAddress, WETHAddress, 500000, 500);
    // console.log(" result = ", result);

    const amount = await quote.callStatic.quoteExactInput(encode, 5000000000);

    console.log(" amount = ", amount);

    // const amount = await quote.connect(OwnerPaymaster).callStatic.quoteExactInput(encode, 500000);

    // console.log(" amount = ", amount);
}
test();

import { ethers } from "hardhat";

import { ERC20__factory, EntryPoint__factory, MockWrappedETH__factory, TokenPaymaster__factory } from "../../typechain-types";
import { WETH9 } from "@uniswap/sdk-core";
import { weth_abi } from "./weth";
import { Wallet } from "ethers";
import { parseEther } from "ethers/lib/utils";

async function readata() {
    const WETH = ERC20__factory.connect("0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", ethers.provider);
    //const paymaster = "0x04B2Dcad8B385b534FdA55f33168B24FA2547A08";

    const paymaster = TokenPaymaster__factory.connect("0x04B2Dcad8B385b534FdA55f33168B24FA2547A08", ethers.provider);
    console.log(" ETH in paymaster = ", await ethers.provider.getBalance(paymaster.address));
    console.log(" native address = ", await paymaster.wrappedNative());

    const weth = new ethers.Contract("0x82af49447d8a07e3bd95bd0d56f35241523fbab1", weth_abi, ethers.provider);

    const fundWallet = new Wallet("0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e", ethers.provider);

    const EntryPoint = EntryPoint__factory.connect("0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789", ethers.provider);

    //await EntryPoint.connect(fundWallet).depositTo(paymaster.address, { value: parseEther("0.01") });

    console.log(" deposit paymaster = ", await EntryPoint.balanceOf(paymaster.address));
    console.log(" deposit wallet = ", await EntryPoint.balanceOf("0x91608c689f75e82f3706c8a759702ff2d2bd31c5"));
}
readata();

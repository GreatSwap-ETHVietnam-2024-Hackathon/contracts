import { ethers } from "hardhat";

import { ERC20__factory, EntryPoint__factory, MockWrappedETH__factory, TokenPaymaster__factory } from "../../typechain-types";
import { WETH9 } from "@uniswap/sdk-core";
import { Wallet } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { weth_abi } from "../../abis/weth";

async function readata() {
    const paymaster = TokenPaymaster__factory.connect("0xA7544F5320d1fec58c829A7e0e19143173c3Dd05", ethers.provider);
    console.log(" ETH in paymaster = ", await ethers.provider.getBalance(paymaster.address));
    // console.log(" native address = ", await paymaster.wrappedNative());

    const fundWallet = new Wallet("0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e", ethers.provider);
    const EntryPoint = EntryPoint__factory.connect("0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789", ethers.provider);
    await EntryPoint.connect(fundWallet).depositTo(paymaster.address, { value: parseEther("0.01") });

    console.log(" deposit paymaster = ", await EntryPoint.balanceOf(paymaster.address));
    console.log(" deposit wallet = ", await EntryPoint.balanceOf("0xA7544F5320d1fec58c829A7e0e19143173c3Dd05"));
}
readata();

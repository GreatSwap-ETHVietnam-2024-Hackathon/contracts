import { Wallet } from "ethers";
import { ethers } from "hardhat";
import { EcdsaOwnershipRegistryModule__factory, SmartAccountFactory__factory } from "../../typechain-types";
import { Multicall__factory } from "../../contract-types";
import { parseEther } from "ethers/lib/utils";

async function distributeFundSAs() {

    const fundWallet = new Wallet("0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e", ethers.provider)
    const sasOwnerWallet = new Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", ethers.provider)
    const numberOfSAs = 100;
    const indexes = [...Array(numberOfSAs).keys()]

    const saFactoryAddress = "0xB435767a057B2B70e36e3c1ea5aBedb09346beD6";
    const swapSKMAddress = "0x7677BFA00826363F9d4f8fBd866EE89644db0161";
    const ecdsaModuleAddress = "0x9B133f75b1f895572F817CC36F27379E520f86c7";
    const multicallAddress = "0xcA11bde05977b3631167028862bE2a173976CA11"

    const factoryInterface = SmartAccountFactory__factory.createInterface();
    const calls = indexes.map(index => ({
        target: saFactoryAddress,
        allowFailure: true,
        callData: SmartAccountFactory__factory.createInterface().encodeFunctionData("getAddressForCounterFactualAccount", [
            swapSKMAddress,
            ecdsaModuleAddress,
            EcdsaOwnershipRegistryModule__factory.createInterface().encodeFunctionData(
                "initForSmartAccount",
                [sasOwnerWallet.address]
            ),
            index
        ])
    }))

    const multicall = Multicall__factory.connect(multicallAddress, ethers.provider);
    const results = await multicall.callStatic.aggregate3(calls)

    const SAs = results.map(res => factoryInterface.decodeFunctionResult("getAddressForCounterFactualAccount", res.returnData)[0].toLowerCase())

    const fund = parseEther('1');
    for (let sa of SAs) {
        const code = await ethers.provider.getCode(sa);
        console.log(code);
        await fundWallet.sendTransaction({
            to: sa,
            value: fund
        })
    }
}
distributeFundSAs();
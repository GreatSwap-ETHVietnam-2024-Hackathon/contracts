import { Wallet } from "ethers";
import { ethers } from "hardhat";
import { EcdsaOwnershipRegistryModule__factory, SmartAccountFactory__factory } from "../../typechain-types";

async function createSAs() {
    const sasOwnerWallet = new Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", ethers.provider)
    const numberOfSAs = 100;
    const chunk = 10;
    const numberOfChunk = 10;

    const saFactoryAddress = "0xB435767a057B2B70e36e3c1ea5aBedb09346beD6";
    const swapSKMAddress = "0x7677BFA00826363F9d4f8fBd866EE89644db0161";
    const ecdsaModuleAddress = "0x9B133f75b1f895572F817CC36F27379E520f86c7";


    const indexes = [...Array(numberOfSAs).keys()]

    for (let i = 0; i < numberOfChunk; i++) {
        const tx = await SmartAccountFactory__factory.connect(saFactoryAddress, sasOwnerWallet).deployMultipleCounterFactualAccounts(
            swapSKMAddress,
            ecdsaModuleAddress,
            EcdsaOwnershipRegistryModule__factory.createInterface().encodeFunctionData(
                "initForSmartAccount",
                [sasOwnerWallet.address]
            ),
            indexes.slice(chunk * i, chunk * (i + 1))
        )

        await tx.wait();
    }
}
createSAs();
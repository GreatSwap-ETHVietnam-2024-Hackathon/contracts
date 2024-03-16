import { Wallet } from "ethers";
import { formatEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import HDKey from "hdkey";
import { SwapSessionKeyManager__factory } from "../../typechain-types";

async function readFund() {
    const relayerSeed = process.env.RELAYER_SEED!;
    const hdKey = HDKey.fromMasterSeed(Buffer.from(relayerSeed, 'hex'));
    function getRelayer(index: number) {
        const derivationPath = `m/1'/1'/1'/${index}`
        const childKey = hdKey.derive(derivationPath)
        return new Wallet(childKey.privateKey, ethers.provider)
    }
    const relayers = [...[...Array(4).keys()]].map(i => getRelayer(i).address);
    const recipients =
        [
            // Nhat's wallets
            // "0x2c9a413bE3eDCc98c4a14E5469bd324770bDF666",
            // "0x5be6999c44359d967b320f3be4acdc72b6969d84",
            // "0x9bf1752661cb8d7ce924593662c299816348dbc8",
            // "0xf2e6594496047cb6f08e232e4a4db19c3c4e2b04",
            // "0x130aadcaff7e3362111a65dd4dfec76465d1ee49",
            // "0xae5b6667d2838b18e8cdf8c182be4286a3af8483",

            // Son's wallets
            // "0x1AFc1eaCA1B4C5f571314bF22e31367134B61943",
            // "0x2195106d0e264a389699cc2c56ed148dfc1d3632",
            // "0x870756c187b5172bcb658fc036f9f806fbefc223",
            // "0x28a53442f7174ef238f6ec1cfd16e09903ff726e",
            // "0x42ca6eb9319cf1d23c10ae71a16459b5468c46a3",
            // "0x14f0d4c54fc0081f3267d637ead46ecbe7e7ce15",

            // Tracy's wallets
            // "0x577929537a211AD2505A908d218eE587286a9d07",
            // "0xdc4b6fee9f846d0ce8646386a1656ad7d2a80900",
            // "0x249e99ef5a5d10b74cf25da17ee82128f8fa3853",
            // "0xeef0fb7fff48f2e16df0a656831b9d34518b4ee1",
            // "0xb976f42ced7d63e00adf1e9258ae8bbb23ef858c",
            // "0xdf1c450beb7e5370ab2908fc8d318b2b3fe4f42b",

            ...relayers
        ]

    for (let i = 0; i < recipients.length; i++) {
        const fund = await ethers.provider.getBalance(recipients[i]);
        console.log(recipients[i], ": ", formatEther(fund));
    }

    const swapSessionKeyManager = SwapSessionKeyManager__factory.connect("0x7677BFA00826363F9d4f8fBd866EE89644db0161", ethers.provider);
    const feeRecipient = await swapSessionKeyManager.FEE_RECIPIENT();
    console.log(feeRecipient)
}
readFund();
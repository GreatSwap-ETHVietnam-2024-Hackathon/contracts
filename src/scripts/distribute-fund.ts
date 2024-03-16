import { Wallet } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import HDKey from "hdkey";

async function distributeFund() {
    const relayerSeed = process.env.RELAYER_SEED!;
    const hdKey = HDKey.fromMasterSeed(Buffer.from(relayerSeed, "hex"));
    function getRelayer(index: number) {
        const derivationPath = `m/1'/1'/1'/${index}`;
        const childKey = hdKey.derive(derivationPath);
        return new Wallet(childKey.privateKey, ethers.provider);
    }
    const relayers = [...[...Array(4).keys()]].map((i) => getRelayer(i).address);
    const fundWallet = new Wallet("0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e", ethers.provider);
    const recipients = [
        //Gu Wallets
        "0x8dbdb10e05e616b5480695dbfb93ceed938af863",
        "0x8dbdb10e05e616b5480695dbfb93ceed938af863",
        "0xd83e8ad61ed13247db7bbb9d17e3b3d933992fe5",
        // Nhat's wallets
        //"0x980f43f59716edafe3197150976040ba15257b62",
        // "0x7dfc0571a2129873e4371901d8921e8cabc055b9",
        // "0x9986ddd707e4f0af381856ad8057e888556e4c7e",
        // "0x8c024e58ad9738c667300c81fdb198b3dd97ba9e",
        // "0x3f8e6f8aac18440b0cfaeee004969629e56820a2",
        // "0xd68a058656c0c475e491941d492a3b7f3adea3c8",
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
        // "0x52d082F9F486730e5e472fAE6A79fe9740D22575",
        ...relayers,
    ];
    const fund = parseEther("1.005");
    for (let i = 0; i < recipients.length; i++)
        await fundWallet.sendTransaction({
            to: recipients[i],
            value: fund,
        });
}
distributeFund();

import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { defaultFeeRate, getEcdsaOwnershipRegistryModule } from "../../utils/setupHelper";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const ecdsaModule = await getEcdsaOwnershipRegistryModule();
    const WETHAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const feeRecipient = "0x443D390b51bEdB620F9c8De2a0a9a060D9BDf4aC"

    await deploy("SwapSessionKeyManager", {
        from: deployer,
        args: [ecdsaModule.address, WETHAddress, feeRecipient, defaultFeeRate],
        log: true,
        deterministicDeployment: true,
        autoMine: true,
    });
};

deploy.tags = ["main-suite", "folked-ethereum"];
export default deploy;
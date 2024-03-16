import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { defaultFeeRate, getEcdsaOwnershipRegistryModule } from "../../utils/setupHelper";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const ecdsaModule = await getEcdsaOwnershipRegistryModule();
    const WETHAddress = "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f";

    const feeRecipient = "0x443D390b51bEdB620F9c8De2a0a9a060D9BDf4aC"
    await deploy("SwapSessionKeyManager", {
        from: deployer,
        args: [ecdsaModule.address, WETHAddress, feeRecipient, defaultFeeRate],
        log: true,
        deterministicDeployment: true,
        autoMine: true,
    });
};

deploy.tags = ["arbitrum-mainnet"];
export default deploy;
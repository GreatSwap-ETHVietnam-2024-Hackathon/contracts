import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { defaultFeeRate, feeRecipient, getEcdsaOwnershipRegistryModule, getMockWETH } from "../../utils/setupHelper";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const ecdsaModule = await getEcdsaOwnershipRegistryModule();
  const mockWETH = await getMockWETH();
  await deploy("SwapSessionKeyManager", {
    from: deployer,
    args: [ecdsaModule.address, mockWETH.address, feeRecipient, defaultFeeRate],
    log: true,
    deterministicDeployment: true,
    autoMine: true,
  });
};

deploy.tags = ["local"];
export default deploy;

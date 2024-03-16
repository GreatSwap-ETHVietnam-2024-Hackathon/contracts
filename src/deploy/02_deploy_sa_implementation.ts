import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const entryPoint = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"

  await deploy("SmartAccount", {
    from: deployer,
    args: [entryPoint],
    log: true,
    deterministicDeployment: true,
    autoMine: true,
  });
};

deploy.tags = ["local", "folked-ethereum", "folked-linea"];
export default deploy;

import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  getSmartAccountImplementation,
} from "../../utils/setupHelper";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const smartAccountImplementation = await getSmartAccountImplementation();

  await deploy("SmartAccountFactory", {
    from: deployer,
    args: [smartAccountImplementation.address, "0x1EafF6143710E98591c926b69bCb444dBE21cFb7"],
    log: true,
    deterministicDeployment: true,
    autoMine: true,
  });
};

deploy.tags = ["local", "folked-ethereum", "folked-linea"];
export default deploy;
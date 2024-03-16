import hre, { deployments, ethers } from "hardhat";
import { Wallet, Contract, BytesLike } from "ethers";
import { EcdsaOwnershipRegistryModule__factory, EntryPoint__factory, MockToken__factory, SmartAccountFactory__factory, SmartAccount__factory, SmartContractOwnershipRegistryModule__factory, MockWrappedETH__factory, MockRouter__factory, SwapSessionKeyManager__factory } from "../typechain-types";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
//@ts-ignore
import solc from "solc";
import { address } from "./solidityTypes";
import { parseEther, parseUnits } from "ethers/lib/utils";

export const defaultGasOptions = {
  gasLimit: 10000000
}
export const getEntryPoint = async () => {
  const EntryPointDeployment = await deployments.get("EntryPoint");
  return EntryPoint__factory.connect(
    EntryPointDeployment.address,
    ethers.provider
  );
};

export const getMockWETH = async () => {
  const MockWETHDeployment = await deployments.get("MockWrappedETH");
  return MockWrappedETH__factory.connect(MockWETHDeployment.address, ethers.provider);
}

export const getMockRouter = async () => {
  const MockRouterDeployment = await deployments.get("MockRouter");
  return MockRouter__factory.connect(MockRouterDeployment.address, ethers.provider);
}

export const getSmartAccountImplementation = async () => {
  const SmartAccountImplDeployment = await deployments.get("SmartAccount");
  return SmartAccount__factory.connect(SmartAccountImplDeployment.address, ethers.provider);
};

export const getSmartAccountFactory = async () => {
  const SAFactoryDeployment = await deployments.get("SmartAccountFactory");
  return SmartAccountFactory__factory.connect(SAFactoryDeployment.address, ethers.provider);
};

export const getStakedSmartAccountFactory = async () => {

  const smartAccountFactory = await getSmartAccountFactory();
  const entryPoint = await getEntryPoint();
  const unstakeDelay = 600;
  const stakeValue = ethers.utils.parseEther("10");
  await smartAccountFactory.addStake(entryPoint.address, unstakeDelay, {
    value: stakeValue,
  });
  return smartAccountFactory;
};

export const feeRecipient = "0x2c9a413bE3eDCc98c4a14E5469bd324770bDF666"
export const defaultFeeRate = parseUnits('0.0025', 6);
export const defaultFeeThreshold = parseEther('0.0025');

export const getSessionKeyManager = async () => {
  const SessionKeyManagerDeployment = await deployments.get("SwapSessionKeyManager");
  return SwapSessionKeyManager__factory.connect(SessionKeyManagerDeployment.address, ethers.provider)
}
export const getMockToken = async () => {
  const MockTokenDeployment = await deployments.get("MockToken");
  return MockToken__factory.connect(MockTokenDeployment.address, ethers.provider);
};

export const getEcdsaOwnershipRegistryModule = async () => {
  const EcdsaOwnershipRegistryModuleDeployment = await deployments.get(
    "EcdsaOwnershipRegistryModule"
  );
  return EcdsaOwnershipRegistryModule__factory.connect(EcdsaOwnershipRegistryModuleDeployment.address, ethers.provider)
};

export const getSmartContractOwnershipRegistryModule = async () => {
  const SmartContractOwnerhsipRegistryDeployment = await deployments.get(
    "SmartContractOwnershipRegistryModule"
  );
  return SmartContractOwnershipRegistryModule__factory.connect(SmartContractOwnerhsipRegistryDeployment.address, ethers.provider)
};

export const getVerifyingPaymaster = async (
  owner: Wallet | SignerWithAddress,
  verifiedSigner: Wallet | SignerWithAddress
) => {
  const entryPoint = await getEntryPoint();
  const VerifyingSingletonPaymaster = await hre.ethers.getContractFactory(
    "VerifyingSingletonPaymaster"
  );
  const verifyingSingletonPaymaster = await VerifyingSingletonPaymaster.deploy(
    owner.address,
    entryPoint.address,
    verifiedSigner.address
  );

  await verifyingSingletonPaymaster
    .connect(owner)
    .addStake(10, { value: ethers.utils.parseEther("2") });

  await verifyingSingletonPaymaster.depositFor(verifiedSigner.address, {
    value: ethers.utils.parseEther("1"),
  });

  await entryPoint.depositTo(verifyingSingletonPaymaster.address, {
    value: ethers.utils.parseEther("10"),
  });

  return verifyingSingletonPaymaster;
};

export const getSmartAccountWithModule = async (
  sessionKeyManager: address,
  authModuleContract: address,
  moduleSetupData: BytesLike,
  index: number,
) => {
  const factory = await getSmartAccountFactory();

  const expectedSmartAccountAddress =
    await factory.getAddressForCounterFactualAccount(
      sessionKeyManager,
      authModuleContract,
      moduleSetupData,
      index
    );

  return SmartAccount__factory.connect(expectedSmartAccountAddress, ethers.provider)
};

export const compile = async (
  source: string,
  settingsOverrides?: { evmVersion?: string }
) => {
  const input = JSON.stringify({
    language: "Solidity",
    settings: {
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode"],
        },
      },
      ...settingsOverrides,
    },
    sources: {
      "tmp.sol": {
        content: source,
      },
    },
  });
  const solcData = await solc.compile(input);
  const output = JSON.parse(solcData);
  if (!output.contracts) {
    console.log(output);
    throw Error("Could not compile contract");
  }
  const fileOutput = output.contracts["tmp.sol"];
  const contractOutput = fileOutput[Object.keys(fileOutput)[0]];
  const abi = contractOutput.abi;
  const data = "0x" + contractOutput.evm.bytecode.object;
  return {
    data: data,
    interface: abi,
  };
};

export const deployContract = async (
  deployer: Wallet | SignerWithAddress,
  source: string,
  settingsOverrides?: { evmVersion?: string }
): Promise<Contract> => {
  const output = await compile(source, settingsOverrides);
  const transaction = await deployer.sendTransaction({
    data: output.data,
    gasLimit: 6000000,
  });
  const receipt = await transaction.wait();
  return new Contract(receipt.contractAddress, output.interface, deployer);
};

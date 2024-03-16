import { ERC20, ERC20__factory, EcdsaOwnershipRegistryModule, EcdsaOwnershipRegistryModule__factory, EntryPoint, EntryPoint__factory, SmartAccount, SmartAccountFactory, SmartAccountFactory__factory, SmartAccount__factory, SwapSessionKeyManager, SwapSessionKeyManager__factory } from "../typechain-types";
import { Wallet } from "ethers";
import { formatEther, formatUnits, hexConcat, hexZeroPad, hexlify, keccak256, parseEther } from "ethers/lib/utils";
import MerkleTree from "merkletreejs";
import { defaultGasOptions, feeRecipient } from "../utils/setupHelper";
import { ethers, getNamedAccounts } from "hardhat";
import { makeEcdsaModuleUserOp } from "../utils/userOp";
import { buildApprovalTx, buildBuyPaymentTx, buildSellPaymentTx, buildUniV3ExactInputSingleTx, calculatePaymentAndAmountIn } from "../utils/tx-builder";
import { expect } from "chai";
import SessionKeyUserOpBuilder from "../utils/sessionKey";
import { ARBAddress, CamelotV3RouterAddress, USDCAddress, UniswapV3RouterAddress, WBTCAddress, WETHAddress, ecdsaOwnershipRegistryModuleAddress, entryPointAddress, sessionKeyManagerAddress, smartAccountFactoryAddress } from "../utils/constants";

describe("Trade on Uniswap v3", () => {
    let alice: string;
    let charlie: string;
    const provider = ethers.provider;
    const deployer = new Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
    const smartAccountOwner = new Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", provider)
    const sessionKey = new Wallet("0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", provider);



    let factory: SmartAccountFactory;
    let entryPoint: EntryPoint;
    let ecdsaModule: EcdsaOwnershipRegistryModule;
    let userSA: SmartAccount;
    let sessionKeyManager: SwapSessionKeyManager;
    let sessionPublicKey: string;

    let merkleTree: MerkleTree;

    let validAfter: number = 0;
    let validUntil: number = 0;

    let USDC: ERC20;
    let WETH: ERC20;
    let WBTC: ERC20;
    let ARB: ERC20;

    let opBuilder: SessionKeyUserOpBuilder;

    const deadline = Date.now() + 10000;

    function calculateLeaf(
        token: string,
        router: string
    ) {
        return keccak256(
            hexConcat([
                hexZeroPad(hexlify(validUntil), 6),
                hexZeroPad(hexlify(validAfter), 6),
                hexZeroPad(hexlify(token), 20),
                hexZeroPad(hexlify(sessionPublicKey), 20),
                hexZeroPad(hexlify(userSA.address), 20),
                hexZeroPad(hexlify(router), 20),
            ])
        )
    }
    const setupTests = async () => {

        const ethBalance = await provider.getBalance(userSA.address)
        if (ethBalance.lt(parseEther('0.0001')))
            await deployer.sendTransaction({
                to: userSA.address,
                value: parseEther("10"),
            });

        const isModuleEnabled = await userSA.isModuleEnabled(sessionKeyManager.address)
        if (!isModuleEnabled) {
            const userOp = await makeEcdsaModuleUserOp(
                "enableModule",
                [sessionKeyManager.address],
                userSA.address,
                smartAccountOwner,
                entryPoint,
                ecdsaModule.address
            );

            await entryPoint.handleOps([userOp], deployer.address, defaultGasOptions);
        }

        const tx = await sessionKeyManager.connect(smartAccountOwner).setMerkleRoot(
            merkleTree.getHexRoot()
        )
        await tx.wait();


    }

    before("init params", async () => {
        const accounts = await getNamedAccounts();
        alice = accounts.alice;
        charlie = accounts.charlie;

        USDC = ERC20__factory.connect(USDCAddress, provider);
        WETH = ERC20__factory.connect(WETHAddress, provider);
        WBTC = ERC20__factory.connect(WBTCAddress, provider);
        ARB = ERC20__factory.connect(ARBAddress, provider);

        entryPoint = EntryPoint__factory.connect(entryPointAddress, deployer);

        ecdsaModule = EcdsaOwnershipRegistryModule__factory.connect(ecdsaOwnershipRegistryModuleAddress, provider);

        sessionKeyManager = SwapSessionKeyManager__factory.connect(sessionKeyManagerAddress, provider);

        sessionPublicKey = sessionKey.address;

        factory = SmartAccountFactory__factory.connect(smartAccountFactoryAddress, deployer);

        const ecdsaOwnershipSetupData =
            EcdsaOwnershipRegistryModule__factory.createInterface().encodeFunctionData(
                "initForSmartAccount",
                [smartAccountOwner.address]
            );
        const smartAccountDeploymentIndex = 0

        const smartAccountAddress =
            await factory.getAddressForCounterFactualAccount(
                sessionKeyManagerAddress,
                ecdsaModule.address,
                ecdsaOwnershipSetupData,
                smartAccountDeploymentIndex,
            );
        const isDeployed = (await provider.getCode(smartAccountAddress)).length > 2;

        if (!isDeployed) {
            await factory.deployCounterFactualAccount(
                sessionKeyManagerAddress,
                ecdsaModule.address,
                ecdsaOwnershipSetupData,
                smartAccountDeploymentIndex,
            );
        }

        userSA = SmartAccount__factory.connect(smartAccountAddress, provider);

        const tokens = [ARBAddress, WBTCAddress];
        const routers = [UniswapV3RouterAddress, CamelotV3RouterAddress];
        const leaves: string[] = []
        for (let token of tokens) {
            for (let router of routers) {
                const leaf = calculateLeaf(token, router)
                leaves.push(leaf);
            }
        }

        merkleTree = new MerkleTree(
            leaves,
            keccak256, {
            sortPairs: true,
            hashLeaves: false,
        });

        opBuilder = new SessionKeyUserOpBuilder(
            entryPoint.address,
            sessionKeyManager.address,
            userSA.address,
            sessionKey
        )
            .withValidUntil(validUntil)
            .withValidAfter(validAfter)

    })
    it("setup test", async () => {
        await setupTests()
        const isModuleEnabled = await userSA.isModuleEnabled(sessionKeyManager.address)
        expect(isModuleEnabled).to.be.true;
    })

    it.skip("Should buy WBTC on Uniswap v3 successfully", async () => {
        expect(
            (await sessionKeyManager.getSessionRoot(smartAccountOwner.address))
        ).to.equal(merkleTree.getHexRoot());


        const preETH = await provider.getBalance(feeRecipient);

        const spentAmount = parseEther('0.2');
        const { payment, amountIn } = calculatePaymentAndAmountIn(spentAmount);

        const buyTx = buildUniV3ExactInputSingleTx(
            UniswapV3RouterAddress,
            amountIn,
            {
                tokenIn: WETHAddress,
                tokenOut: WBTCAddress,
                amountIn,
                amountOutMinimum: parseEther('0'),
                fee: 500,
                deadline,
                recipient: userSA.address,
                sqrtPriceLimitX96: parseEther('0')
            }
        )

        const paymentTx = buildBuyPaymentTx(payment);

        const swapOp = await (opBuilder
            .withToken(WBTCAddress)
            .withRouter(UniswapV3RouterAddress)
            .withBuyTxs([buyTx, paymentTx])
            .withMerkleProof(
                merkleTree.getHexProof(
                    calculateLeaf(WBTCAddress, UniswapV3RouterAddress)
                )
            )
        ).build()


        const receipt = await entryPoint.handleOps([swapOp], alice, defaultGasOptions);
        await receipt.wait();

        const postETH = await provider.getBalance(feeRecipient);

        expect(postETH.sub(preETH).eq(payment)).to.be.true;
    })

    it.skip("Should sell 100% WBTC on Uniswap v3 successfully", async () => {

        const preWBTC = await WBTC.balanceOf(feeRecipient);

        const spentWBTC = await WBTC.balanceOf(userSA.address);
        const { amountIn, payment } = calculatePaymentAndAmountIn(spentWBTC);

        const approveTx = buildApprovalTx(WBTC.address, amountIn, UniswapV3RouterAddress);

        const sellTx = buildUniV3ExactInputSingleTx(
            UniswapV3RouterAddress,
            parseEther('0'),
            {
                tokenIn: WBTCAddress,
                tokenOut: WETHAddress,
                amountIn: amountIn,
                amountOutMinimum: parseEther('0'),
                fee: 500,
                deadline,
                recipient: userSA.address,
                sqrtPriceLimitX96: parseEther('0')
            }
        )

        const postOpTx = buildSellPaymentTx(
            WBTCAddress,
            payment
        )

        const swapOp = await (opBuilder
            .withToken(WBTCAddress)
            .withRouter(UniswapV3RouterAddress)
            .withSellTxs([approveTx, sellTx, postOpTx])
            .withMerkleProof(
                merkleTree.getHexProof(
                    calculateLeaf(WBTCAddress, UniswapV3RouterAddress)
                )
            )
        ).build()


        const receipt = await entryPoint.handleOps([swapOp], alice, defaultGasOptions);
        await receipt.wait();

        const postWBTC = await WBTC.balanceOf(feeRecipient);

        expect(postWBTC.sub(preWBTC).eq(payment)).to.be.true;
    })

    it("buy directly", async () => {
        const preETH = await provider.getBalance(deployer.address);
        const ethIn = parseEther('0.2');
        const buyTx = buildUniV3ExactInputSingleTx(
            UniswapV3RouterAddress,
            ethIn,
            {
                tokenIn: WETHAddress,
                tokenOut: WBTCAddress,
                amountIn: ethIn,
                amountOutMinimum: parseEther('0'),
                fee: 500,
                deadline,
                recipient: userSA.address,
                sqrtPriceLimitX96: parseEther('0')
            }
        )
        const tx = await deployer.sendTransaction(buyTx);
        await tx.wait();

        const postETH = await provider.getBalance(deployer.address);
        const deltaETH = preETH.sub(ethIn).sub(postETH);
        console.log(formatEther(deltaETH))
    })
    it("relayer should not lose eth", async () => {
        const preRelayerETH = await provider.getBalance(deployer.address);
        const saPreETH = await provider.getBalance(userSA.address);

        const spentAmount = parseEther('0.2');
        const { payment, amountIn } = calculatePaymentAndAmountIn(spentAmount);

        const buyTx = buildUniV3ExactInputSingleTx(
            UniswapV3RouterAddress,
            amountIn,
            {
                tokenIn: WETHAddress,
                tokenOut: WBTCAddress,
                amountIn,
                amountOutMinimum: parseEther('0'),
                fee: 500,
                deadline,
                recipient: userSA.address,
                sqrtPriceLimitX96: parseEther('0')
            }
        )

        const paymentTx = buildBuyPaymentTx(payment);

        const swapOp = await (opBuilder
            .withToken(WBTCAddress)
            .withRouter(UniswapV3RouterAddress)
            .withBuyTxs([buyTx, paymentTx])
            .withMerkleProof(
                merkleTree.getHexProof(
                    calculateLeaf(WBTCAddress, UniswapV3RouterAddress)
                )
            )
        ).build()

        const feeData = await provider.getFeeData();

        const receipt = await entryPoint.connect(deployer).handleOps(
            [swapOp],
            deployer.address,
            {
                type: 2,
                maxPriorityFeePerGas: feeData.maxPriorityFeePerGas!,
                maxFeePerGas: feeData.maxFeePerGas!
            }
        )
        await receipt.wait();
        const postRelayerETH = await provider.getBalance(deployer.address);
        const saPostETH = await provider.getBalance(userSA.address);

        const deltaSAETH = saPostETH.add(spentAmount).sub(saPreETH);
        const deltaRelayerETH = postRelayerETH.sub(preRelayerETH);

        console.log(formatEther(deltaSAETH));
        console.log(formatEther(deltaRelayerETH));
    })
})
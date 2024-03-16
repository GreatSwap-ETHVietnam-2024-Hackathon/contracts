import { EcdsaOwnershipRegistryModule, EcdsaOwnershipRegistryModule__factory, EntryPoint, MockRouter, MockToken, SmartAccount, SmartAccountFactory, SmartAccountFactory__factory, SmartAccount__factory, SwapSessionKeyManager, SwapSessionKeyManager__factory } from "../typechain-types";
import { BigNumber, Wallet } from "ethers";
import { formatUnits, hexConcat, hexZeroPad, hexlify, keccak256, parseEther } from "ethers/lib/utils";
import MerkleTree from "merkletreejs";
import { defaultGasOptions, feeRecipient, getEcdsaOwnershipRegistryModule, getEntryPoint, getMockRouter, getMockToken, getMockWETH, getSessionKeyManager, getSmartAccountFactory } from "../utils/setupHelper";
import { deployments, ethers, getNamedAccounts } from "hardhat";
import { makeEcdsaModuleUserOp } from "../utils/userOp";
import { buildApprovalTx, buildBuyPaymentTx, buildSellPaymentTx, buildUniV3ExactInputSingleTx, calculatePaymentAndAmountIn } from "../utils/tx-builder";
import { expect } from "chai";
import SessionKeyUserOpBuilder from "../utils/sessionKey";
import { UniswapV3RouterAddress } from "../utils/constants";

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

    let WETH: MockToken;
    let WBTC: MockToken;
    let router: MockRouter;

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

        await deployer.sendTransaction({
            to: userSA.address,
            value: parseEther("10"),
        });

        await WBTC.connect(deployer).mint(userSA.address, parseEther('10'));

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

        await deployments.fixture();

        WETH = await getMockWETH()
        WBTC = await getMockToken()
        router = await getMockRouter()

        entryPoint = (await getEntryPoint()).connect(deployer);

        ecdsaModule = await getEcdsaOwnershipRegistryModule();

        sessionKeyManager = await getSessionKeyManager();

        sessionPublicKey = sessionKey.address;

        factory = await getSmartAccountFactory();

        const ecdsaOwnershipSetupData =
            EcdsaOwnershipRegistryModule__factory.createInterface().encodeFunctionData(
                "initForSmartAccount",
                [smartAccountOwner.address]
            );
        const smartAccountDeploymentIndex = 0

        const smartAccountAddress =
            await factory.getAddressForCounterFactualAccount(
                sessionKeyManager.address,
                ecdsaModule.address,
                ecdsaOwnershipSetupData,
                smartAccountDeploymentIndex,
            );
        const isDeployed = (await provider.getCode(smartAccountAddress)).length > 2;

        if (!isDeployed) {
            await factory.connect(deployer).deployCounterFactualAccount(
                sessionKeyManager.address,
                ecdsaModule.address,
                ecdsaOwnershipSetupData,
                smartAccountDeploymentIndex,
            );
        }

        userSA = SmartAccount__factory.connect(smartAccountAddress, provider);

        const tokens = [WBTC.address];
        const routers = [router.address];
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

    it("Should buy WBTC on Uniswap v3 successfully", async () => {
        expect(
            (await sessionKeyManager.getSessionRoot(smartAccountOwner.address))
        ).to.equal(merkleTree.getHexRoot());
        const spentAmount = parseEther('0.2');

        const preETH = await provider.getBalance(feeRecipient);

        const { amountIn, payment } = calculatePaymentAndAmountIn(spentAmount);

        const buyTx = buildUniV3ExactInputSingleTx(
            router.address,
            amountIn,
            {
                tokenIn: WETH.address,
                tokenOut: WBTC.address,
                amountIn,
                amountOutMinimum: parseEther('0'),
                fee: 500,
                deadline,
                recipient: userSA.address,
                sqrtPriceLimitX96: parseEther('0')
            }
        )

        const postOpTx = buildBuyPaymentTx(
            payment
        )

        const swapOp = await (opBuilder
            .withToken(WBTC.address)
            .withRouter(router.address)
            .withBuyTxs([buyTx, postOpTx])
            .withMerkleProof(
                merkleTree.getHexProof(
                    calculateLeaf(WBTC.address, router.address)
                )
            )
        ).build()


        const receipt = await entryPoint.handleOps([swapOp], alice, defaultGasOptions);
        await receipt.wait();

        const postETH = await provider.getBalance(feeRecipient);

        expect(postETH.sub(preETH).eq(payment)).to.be.true;
    })

    it("Should sell 100% WBTC on Uniswap v3 successfully", async () => {

        const preWBTC = await WBTC.balanceOf(feeRecipient);
        const WBTCIn = parseEther('1');

        const { payment, amountIn } = calculatePaymentAndAmountIn(WBTCIn);

        const approveTx = buildApprovalTx(WBTC.address, amountIn, UniswapV3RouterAddress);

        const sellTx = buildUniV3ExactInputSingleTx(
            router.address,
            parseEther('0'),
            {
                tokenIn: WBTC.address,
                tokenOut: WETH.address,
                amountIn,
                amountOutMinimum: parseEther('0'),
                fee: 500,
                deadline,
                recipient: userSA.address,
                sqrtPriceLimitX96: parseEther('0')
            }
        )

        const paymentTx = buildSellPaymentTx(
            WBTC.address,
            payment
        )

        const swapOp = await (opBuilder
            .withToken(WBTC.address)
            .withRouter(router.address)
            .withSellTxs([approveTx, sellTx, paymentTx])
            .withMerkleProof(
                merkleTree.getHexProof(
                    calculateLeaf(WBTC.address, router.address)
                )
            )
        ).build()


        const receipt = await entryPoint.handleOps([swapOp], alice, defaultGasOptions);
        await receipt.wait();

        const postWBTC = await WBTC.balanceOf(feeRecipient);

        console.log(formatUnits(preWBTC, 18));
        console.log(formatUnits(postWBTC, 18));

        expect(postWBTC.sub(preWBTC).eq(payment)).to.be.true;
    })
})
import { BigNumber, Wallet } from "ethers";
import { ethers } from "hardhat";
import { EntryPoint__factory, SmartAccount__factory } from "../typechain-types";
import { fillAndSign } from "./userOp";
import { defaultAbiCoder, parseEther } from "ethers/lib/utils";
import { Transaction } from "./tx-builder";
import { AddressZero } from "./testUtils";

interface BuilderOptions {
  preVerificationGas?: number;
}
export default class SessionKeyUserOpBuilder {
  transactions: Transaction[] = [];
  userOpSender: string;
  sessionKey: Wallet;
  validUntil: number = 0;
  validAfter: number = 0;
  operation: number = 0;
  approveAll: boolean = false;
  merkleProof: string[] = [];
  router: string = AddressZero
  token: string = AddressZero
  entryPoint: string
  swapSessionKeyManager: string
  options?: BuilderOptions

  constructor(
    entryPoint: string,
    swapSessionKeyManager: string,
    userOpSender: string,
    sessionKey: Wallet,
  ) {
    this.entryPoint = entryPoint;
    this.swapSessionKeyManager = swapSessionKeyManager;
    this.userOpSender = userOpSender;
    this.sessionKey = sessionKey;
  }

  withApproveAll(approveAll: boolean) {
    this.approveAll = approveAll;
    return this;
  }

  withToken(token: string) {
    this.token = token;
    return this
  }

  withRouter(router: string) {
    this.router = router;
    return this
  }

  withValidUntil(validUntil: number) {
    this.validUntil = validUntil
    return this
  }

  withValidAfter(validAfter: number) {
    this.validAfter = validAfter
    return this
  }

  withMerkleProof(merkleProof: string[]) {
    this.merkleProof = merkleProof;
    return this;
  }

  withPreApproveTx(tx: Transaction) {
    this.transactions = [tx];
    this.operation = 2;
    return this;
  }

  withBuyTxs(swapTxs: Transaction[]) {
    this.transactions = swapTxs
    this.operation = 0;
    return this
  }

  withSellTxs(swapTxs: Transaction[]) {
    this.transactions = swapTxs
    this.operation = 1;
    return this
  }

  withOptions(options: Partial<BuilderOptions>) {
    if (this.options)
      Object.assign(this.options, options)
    else this.options = options
  }

  async build() {
    if (!this.token) {
      throw new Error("No token provided")
    }

    let txnDataAA1: string;

    if (this.transactions.length === 1) {
      const tx = this.transactions[0]
      txnDataAA1 = SmartAccount__factory.createInterface().encodeFunctionData("execute_ncC", [
        tx.to,
        tx.value,
        tx.data
      ]);
    } else {
      const txs = this.transactions
      txnDataAA1 = SmartAccount__factory.createInterface().encodeFunctionData("executeBatch_y6U", [
        txs.map(tx => tx.to),
        txs.map(tx => tx.value),
        txs.map(tx => tx.data)
      ]);
    }

    const userOp = await fillAndSign(
      {
        sender: this.userOpSender,
        callData: txnDataAA1,
        ...this.options,
      },
      this.sessionKey,
      EntryPoint__factory.connect(this.entryPoint, ethers.provider)
    );

    const paddedSig = defaultAbiCoder.encode(
      [
        "uint48",
        "uint48",
        "address",
        "address",
        "address",
        "uint8",
        "bool",
        "bytes32[]",
        "bytes"
      ],
      [
        this.validUntil,
        this.validAfter,
        this.router,
        this.token,
        this.sessionKey.address,
        this.operation,
        this.approveAll,
        this.merkleProof,
        userOp.signature,
      ]
    );

    const signatureWithModuleAddress = defaultAbiCoder.encode(
      ["bytes", "address"],
      [paddedSig, this.swapSessionKeyManager]
    );
    userOp.signature = signatureWithModuleAddress;

    return userOp;
  }
}
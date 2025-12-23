import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

import { ConfidentialUSDT, ConfidentialUSDT__factory, NovaLend, NovaLend__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
};

async function deployFixture(signers: Signers) {
  const cusdtFactory = (await ethers.getContractFactory("ConfidentialUSDT")) as ConfidentialUSDT__factory;
  const cusdt = (await cusdtFactory.connect(signers.deployer).deploy()) as ConfidentialUSDT;
  const cusdtAddress = await cusdt.getAddress();

  const novaLendFactory = (await ethers.getContractFactory("NovaLend")) as NovaLend__factory;
  const novaLend = (await novaLendFactory.connect(signers.deployer).deploy(cusdtAddress)) as NovaLend;
  const novaLendAddress = await novaLend.getAddress();

  await (await cusdt.connect(signers.deployer).setMinter(novaLendAddress)).wait();

  return { cusdt, cusdtAddress, novaLend, novaLendAddress };
}

describe("NovaLend", function () {
  let signers: Signers;

  before(async function () {
    const ethSigners = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }
  });

  it("stakes ETH and updates encrypted collateral", async function () {
    const { novaLend, novaLendAddress } = await deployFixture(signers);

    const stakeWei = ethers.parseEther("1.0");
    await (await novaLend.connect(signers.alice).stake({ value: stakeWei })).wait();

    const encryptedCollateral = await novaLend.encryptedCollateralOf(signers.alice.address);
    const collateralMicroEth = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedCollateral,
      novaLendAddress,
      signers.alice,
    );

    expect(collateralMicroEth).to.eq(1_000_000n);
  });

  it("borrows cUSDT within max LTV and updates encrypted debt", async function () {
    const { cusdt, cusdtAddress, novaLend, novaLendAddress } = await deployFixture(signers);

    await (await novaLend.connect(signers.alice).stake({ value: ethers.parseEther("1.0") })).wait();

    const requestedMicroUsdt = 1_500_000_000n; // 1500 USDT with 6 decimals
    const encryptedInput = await fhevm
      .createEncryptedInput(novaLendAddress, signers.alice.address)
      .add64(requestedMicroUsdt)
      .encrypt();

    await (await novaLend.connect(signers.alice).borrow(encryptedInput.handles[0], encryptedInput.inputProof)).wait();

    const encryptedDebt = await novaLend.encryptedDebtOf(signers.alice.address);
    const debtMicroUsdt = await fhevm.userDecryptEuint(FhevmType.euint64, encryptedDebt, novaLendAddress, signers.alice);

    // With 1 ETH collateral and a fixed 2000 USDT price and 50% LTV, max borrow is 1000 USDT.
    expect(debtMicroUsdt).to.eq(1_000_000_000n);

    const encryptedBalance = await cusdt.confidentialBalanceOf(signers.alice.address);
    const balanceMicroUsdt = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      cusdtAddress,
      signers.alice,
    );
    expect(balanceMicroUsdt).to.eq(1_000_000_000n);
  });

  it("repays cUSDT and reduces encrypted debt", async function () {
    const { cusdt, cusdtAddress, novaLend, novaLendAddress } = await deployFixture(signers);

    await (await novaLend.connect(signers.alice).stake({ value: ethers.parseEther("1.0") })).wait();

    const borrowMicroUsdt = 100_000_000n; // 100 USDT
    const borrowInput = await fhevm
      .createEncryptedInput(novaLendAddress, signers.alice.address)
      .add64(borrowMicroUsdt)
      .encrypt();

    await (await novaLend.connect(signers.alice).borrow(borrowInput.handles[0], borrowInput.inputProof)).wait();

    const until = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
    await (await cusdt.connect(signers.alice).setOperator(novaLendAddress, until)).wait();

    const repayMicroUsdt = 40_000_000n; // 40 USDT
    const repayInput = await fhevm
      .createEncryptedInput(cusdtAddress, novaLendAddress)
      .add64(repayMicroUsdt)
      .encrypt();

    await (await novaLend.connect(signers.alice).repay(repayInput.handles[0], repayInput.inputProof)).wait();

    const encryptedDebt = await novaLend.encryptedDebtOf(signers.alice.address);
    const debtMicroUsdt = await fhevm.userDecryptEuint(FhevmType.euint64, encryptedDebt, novaLendAddress, signers.alice);
    expect(debtMicroUsdt).to.eq(60_000_000n);

    const encryptedBalance = await cusdt.confidentialBalanceOf(signers.alice.address);
    const balanceMicroUsdt = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      cusdtAddress,
      signers.alice,
    );
    expect(balanceMicroUsdt).to.eq(60_000_000n);
  });

  it("withdraws all staked ETH and clears encrypted collateral", async function () {
    const { novaLend, novaLendAddress } = await deployFixture(signers);

    const stakeWei = ethers.parseEther("1.0");
    await (await novaLend.connect(signers.alice).stake({ value: stakeWei })).wait();
    expect(await ethers.provider.getBalance(novaLendAddress)).to.eq(stakeWei);

    await (await novaLend.connect(signers.alice).withdrawAll()).wait();
    expect(await ethers.provider.getBalance(novaLendAddress)).to.eq(0n);

    const encryptedCollateral = await novaLend.encryptedCollateralOf(signers.alice.address);
    const collateralMicroEth = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedCollateral,
      novaLendAddress,
      signers.alice,
    );

    expect(collateralMicroEth).to.eq(0n);
  });
});


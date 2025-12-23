import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

function parseUsdtToMicro(value: string): bigint {
  if (!value) throw new Error("Missing value");
  const [whole, frac = ""] = value.split(".");
  if (!whole.match(/^\d+$/)) throw new Error("Invalid amount");
  if (!frac.match(/^\d*$/)) throw new Error("Invalid amount");
  if (frac.length > 6) throw new Error("Too many decimals (max 6)");
  const paddedFrac = frac.padEnd(6, "0");
  return BigInt(whole) * 1_000_000n + BigInt(paddedFrac || "0");
}

task("task:novalend:addresses", "Prints NovaLend and cUSDT addresses").setAction(async function (
  _taskArguments: TaskArguments,
  hre,
) {
  const { deployments } = hre;

  const novaLend = await deployments.get("NovaLend");
  const cusdt = await deployments.get("ConfidentialUSDT");

  console.log(`NovaLend: ${novaLend.address}`);
  console.log(`cUSDT   : ${cusdt.address}`);
});

task("task:novalend:stake", "Stake ETH into NovaLend")
  .addParam("eth", "ETH amount, e.g. 0.1")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;

    const novaLend = await deployments.get("NovaLend");
    const [signer] = await ethers.getSigners();

    const amountWei = ethers.parseEther(taskArguments.eth);
    const contract = await ethers.getContractAt("NovaLend", novaLend.address);

    const tx = await contract.connect(signer).stake({ value: amountWei });
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:novalend:borrow", "Borrow cUSDT (amount is encrypted via fhevm relayer)")
  .addParam("usdt", "USDT amount with up to 6 decimals, e.g. 100 or 12.34")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const novaLend = await deployments.get("NovaLend");
    const [signer] = await ethers.getSigners();

    const amountMicro = parseUsdtToMicro(taskArguments.usdt);
    if (amountMicro === 0n) throw new Error("Amount must be > 0");

    const input = await fhevm
      .createEncryptedInput(novaLend.address, signer.address)
      .add64(amountMicro)
      .encrypt();

    const contract = await ethers.getContractAt("NovaLend", novaLend.address);
    const tx = await contract.connect(signer).borrow(input.handles[0], input.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:novalend:approve-operator", "Allow NovaLend to transfer your cUSDT for repayments")
  .addOptionalParam("days", "Operator duration in days", "30")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;

    const novaLend = await deployments.get("NovaLend");
    const cusdt = await deployments.get("ConfidentialUSDT");

    const [signer] = await ethers.getSigners();
    const token = await ethers.getContractAt("ConfidentialUSDT", cusdt.address);

    const days = Number(taskArguments.days);
    if (!Number.isFinite(days) || days <= 0) throw new Error("Invalid --days");

    const now = Math.floor(Date.now() / 1000);
    const until = now + Math.floor(days * 24 * 60 * 60);

    const tx = await token.connect(signer).setOperator(novaLend.address, until);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:novalend:repay", "Repay cUSDT (amount is encrypted for the token contract, imported by NovaLend)")
  .addParam("usdt", "USDT amount with up to 6 decimals, e.g. 25 or 1.5")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const novaLend = await deployments.get("NovaLend");
    const cusdt = await deployments.get("ConfidentialUSDT");
    const [signer] = await ethers.getSigners();

    const amountMicro = parseUsdtToMicro(taskArguments.usdt);
    if (amountMicro === 0n) throw new Error("Amount must be > 0");

    const input = await fhevm
      .createEncryptedInput(cusdt.address, novaLend.address)
      .add64(amountMicro)
      .encrypt();

    const contract = await ethers.getContractAt("NovaLend", novaLend.address);
    const tx = await contract.connect(signer).repay(input.handles[0], input.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:novalend:decrypt", "Decrypt your NovaLend position and cUSDT balance")
  .setAction(async function (_taskArguments: TaskArguments, hre) {
    const { deployments, ethers, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const novaLend = await deployments.get("NovaLend");
    const cusdt = await deployments.get("ConfidentialUSDT");
    const [signer] = await ethers.getSigners();

    const lend = await ethers.getContractAt("NovaLend", novaLend.address);
    const token = await ethers.getContractAt("ConfidentialUSDT", cusdt.address);

    const encryptedCollateral = await lend.encryptedCollateralOf(signer.address);
    const encryptedDebt = await lend.encryptedDebtOf(signer.address);
    const encryptedBalance = await token.confidentialBalanceOf(signer.address);

    const collateralMicroEth = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedCollateral,
      novaLend.address,
      signer,
    );
    const debtMicroUsdt = await fhevm.userDecryptEuint(FhevmType.euint64, encryptedDebt, novaLend.address, signer);
    const balanceMicroUsdt = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      cusdt.address,
      signer,
    );

    console.log(`Collateral (micro-ETH): ${collateralMicroEth}`);
    console.log(`Debt      (micro-USDT): ${debtMicroUsdt}`);
    console.log(`cUSDT bal  (micro-USDT): ${balanceMicroUsdt}`);
  });

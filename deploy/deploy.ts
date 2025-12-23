import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, execute } = hre.deployments;

  if (!deployer) {
    throw new Error("Missing deployer account. Set PRIVATE_KEY in your .env before deploying to Sepolia.");
  }

  const deployedFHECounter = await deploy("FHECounter", {
    from: deployer,
    log: true,
  });

  const deployedCUSDT = await deploy("ConfidentialUSDT", {
    from: deployer,
    log: true,
  });

  const deployedNovaLend = await deploy("NovaLend", {
    from: deployer,
    args: [deployedCUSDT.address],
    log: true,
  });

  await execute("ConfidentialUSDT", { from: deployer, log: true }, "setMinter", deployedNovaLend.address);

  console.log(`FHECounter contract:`, deployedFHECounter.address);
  console.log(`ConfidentialUSDT contract:`, deployedCUSDT.address);
  console.log(`NovaLend contract:`, deployedNovaLend.address);
};
export default func;
func.id = "deploy_novalend"; // id required to prevent reexecution
func.tags = ["FHECounter", "NovaLend"];

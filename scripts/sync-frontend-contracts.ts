import * as fs from "fs";
import * as path from "path";

type DeploymentJson = {
  address: string;
  abi: unknown;
};

function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function assertAddress(label: string, value: string): void {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${label} is not a valid address: ${value}`);
  }
}

function loadDeployment(contractName: string): DeploymentJson {
  const filePath = path.join(process.cwd(), "deployments", "sepolia", `${contractName}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing deployment file: ${filePath}. Run 'npm run deploy:sepolia' first.`);
  }
  const deployment = readJsonFile<DeploymentJson>(filePath);
  assertAddress(`${contractName}.address`, deployment.address);
  if (!deployment.abi) {
    throw new Error(`${contractName}.abi is missing in ${filePath}`);
  }
  return deployment;
}

function formatTsConst(name: string, value: unknown): string {
  return `export const ${name} = ${JSON.stringify(value, null, 2)} as const;`;
}

function main() {
  const novaLend = loadDeployment("NovaLend");
  const cusdt = loadDeployment("ConfidentialUSDT");

  const outputPath = path.join(process.cwd(), "app", "src", "config", "contracts.ts");

  const contents = [
    `// Auto-generated from deployments/sepolia. Do not edit manually.`,
    formatTsConst("NOVALEND_ADDRESS", novaLend.address),
    formatTsConst("CUSDT_ADDRESS", cusdt.address),
    ``,
    formatTsConst("NOVALEND_ABI", novaLend.abi),
    ``,
    formatTsConst("CUSDT_ABI", cusdt.abi),
    ``,
  ].join("\n");

  fs.writeFileSync(outputPath, contents, "utf8");
  console.log(`Wrote ${outputPath}`);
}

main();


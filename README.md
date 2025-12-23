# NovaLend

NovaLend is a confidential ETH-collateralized lending demo built on Zama FHEVM. Users stake ETH, borrow encrypted cUSDT,
repay, and withdraw while position sizes remain private on-chain.

## Project Summary

NovaLend demonstrates how fully homomorphic encryption (FHE) can hide sensitive lending data without sacrificing
verifiability. Collateral and debt are stored as encrypted euint64 values, while ETH custody remains on-chain and
auditable.

## At a Glance

- Collateral: ETH (custodied by the protocol, withdrawable by the user)
- Debt token: cUSDT (confidential ERC7984 token)
- Max LTV: 50% (5000 bps)
- Price model: fixed 1 ETH = 2000 USDT (demo constant)
- Units: micro-ETH (1 micro-ETH = 1e12 wei), micro-USDT (6 decimals)
- Privacy: amounts are encrypted with Zama FHEVM (euint64)

## Problem Statement

Public lending protocols expose user positions, borrowing capacity, and repayment behavior. This creates:

- Privacy leakage for traders and treasuries.
- Front-running and competitive monitoring of positions.
- Compliance risk when sensitive balances are publicly visible.

## Solution and Advantages

NovaLend keeps sensitive values encrypted on-chain while preserving deterministic protocol rules.

- Confidential amounts for collateral and debt, while still enforcing LTV.
- On-chain enforcement of borrowing limits without revealing balances.
- Simple, auditable logic that is easy to extend with real pricing and interest models.
- Transparent ETH custody while preserving private position sizes.

## How It Works

1. Stake ETH
   - ETH is transferred into the protocol.
   - The encrypted collateral balance is increased in micro-ETH.
2. Borrow cUSDT
   - The user submits an encrypted borrow amount via the Zama relayer.
   - The contract computes encrypted remaining capacity and mints up to the max.
3. Repay
   - The user transfers encrypted cUSDT to NovaLend.
   - cUSDT is burned and encrypted debt is reduced.
4. Withdraw
   - The user withdraws all ETH and the encrypted collateral balance is cleared.

## Confidential Data Model

- Encrypted types: `euint64` for collateral and debt amounts.
- Allowance handling: `FHE.allow`, `FHE.allowThis`, and `FHE.allowTransient` are used to permit safe reads by the owner,
  the contract itself, and the confidential token.
- Decryption: users decrypt their own positions via the FHEVM relayer or the provided CLI task.

## Protocol Parameters

- `MAX_LTV_BPS = 5000` (50%)
- `ETH_PRICE_MICRO_USDT_PER_MICRO_ETH = 2000`
- `COLLATERAL_SCALE = 1_000_000_000_000` (1 micro-ETH in wei)

## Smart Contracts

- `contracts/NovaLend.sol`
  - Core lending logic (stake, borrow, repay, withdrawAll).
  - Tracks ETH collateral in wei for custody and withdrawal.
  - Tracks encrypted collateral and debt in micro-units.
- `contracts/ConfidentialUSDT.sol`
  - Confidential ERC7984 token.
  - Minting is restricted to the protocol minter.
  - Uses operator approval for confidential transfers.
- `contracts/FHECounter.sol`
  - Reference FHE contract used for baseline validation.

## Frontend

Frontend is located in `app/` and builds a real interface over the deployed contracts.

- React + Vite UI with RainbowKit and Wagmi.
- Read operations use viem; write operations use ethers v6.
- Encrypted inputs and decryption use the Zama relayer SDK.
- Contract ABIs must be copied from `deployments/sepolia` into the frontend code (no JSON imports).
- No Tailwind CSS, no local storage, and no localhost blockchain network in the UI.
- No frontend environment variables; addresses are embedded in the UI code.

## Tech Stack

- Solidity 0.8.27, TypeScript
- Hardhat + hardhat-deploy
- Zama FHEVM + @fhevm/hardhat-plugin
- OpenZeppelin confidential contracts (ERC7984)
- React 19 + Vite 7
- RainbowKit + Wagmi
- viem (read) and ethers v6 (write)

## Project Structure

```
NovaLend/
├── app/                    # React + Vite frontend
├── contracts/              # Smart contracts
├── deploy/                 # Deployment script
├── deployments/            # Network artifacts and ABIs
├── tasks/                  # Hardhat tasks
├── test/                   # Tests
├── hardhat.config.ts       # Hardhat config
└── docs/                   # Zama docs and relayer notes
```

## Setup and Usage

### Prerequisites

- Node.js 20+ and npm
- A wallet with Sepolia ETH
- An Infura project key for Sepolia

### Install Dependencies

```bash
npm install
```

### Configure Environment (Contracts Only)

Create a `.env` at the repository root (used by `hardhat.config.ts` via `dotenv`):

```bash
INFURA_API_KEY=your_infura_project_id
PRIVATE_KEY=0xyour_private_key
ETHERSCAN_API_KEY=optional_etherscan_key
```

Notes:

- Do not use a mnemonic. Deployment uses a private key only.
- `PRIVATE_KEY` can be with or without the `0x` prefix.

### Compile and Test

```bash
npm run compile
npm run test
```

Optional Sepolia test run:

```bash
npm run test:sepolia
```

### Local Development Network (Contracts Only)

```bash
npm run chain
npm run deploy:localhost
```

The frontend is not configured for a localhost network.

### Deploy to Sepolia

```bash
npm run deploy:sepolia
```

Optional verification:

```bash
npm run verify:sepolia -- <CONTRACT_ADDRESS> [CONSTRUCTOR_ARGS...]
```

### Useful Hardhat Tasks

Print deployed addresses:

```bash
npx hardhat task:novalend:addresses --network sepolia
```

Stake ETH:

```bash
npx hardhat task:novalend:stake --network sepolia --eth 0.1
```

Borrow cUSDT (encrypted input):

```bash
npx hardhat task:novalend:borrow --network sepolia --usdt 100
```

Approve NovaLend as operator for repayments:

```bash
npx hardhat task:novalend:approve-operator --network sepolia --days 30
```

Repay cUSDT:

```bash
npx hardhat task:novalend:repay --network sepolia --usdt 25
```

Decrypt your position and cUSDT balance:

```bash
npx hardhat task:novalend:decrypt --network sepolia
```

### Frontend Development

```bash
cd app
npm install
npm run dev
```

Frontend integration checklist:

- Copy contract ABIs from `deployments/sepolia` into frontend code.
- Copy deployed addresses (see task above).
- Use viem for reads and ethers for writes.
- Avoid JSON ABI imports and environment variables.
- Ensure wallet network is Sepolia (not localhost).

## Security Notes and Limitations

This is a demo protocol and intentionally keeps the logic minimal:

- Fixed price model (no oracle).
- No interest rate model.
- No liquidation flow.
- `withdrawAll` does not check outstanding debt (demo behavior).
- No partial withdrawals.

Do not use this in production without completing these components.

## Future Roadmap

- Replace the fixed price with a privacy-preserving oracle flow.
- Add interest accrual and risk parameters per collateral type.
- Add liquidation mechanics with confidential health checks.
- Support partial withdrawals and multi-collateral positions.
- Add governance controls and upgrade paths.
- Harden UI/UX for production and add telemetry-free analytics.
- Expand test coverage with fuzzing and formal checks.

## Documentation

- Zama FHEVM references: `docs/zama_llm.md`
- Relayer usage notes: `docs/zama_doc_relayer.md`

## License

BSD-3-Clause-Clear. See `LICENSE`.

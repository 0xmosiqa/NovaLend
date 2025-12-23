// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, ebool, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHESafeMath} from "@openzeppelin/confidential-contracts/utils/FHESafeMath.sol";

import {ConfidentialUSDT} from "./ConfidentialUSDT.sol";

contract NovaLend is ZamaEthereumConfig {
    uint64 public constant BPS = 10_000;
    uint64 public constant MAX_LTV_BPS = 5_000; // 50%

    // 1 micro-ETH = 1e12 wei, so 1 ETH = 1e6 micro-ETH.
    uint64 public constant COLLATERAL_SCALE = 1_000_000_000_000;

    // Fixed demo price: 1 ETH = 2000 USDT.
    // Since collateral is tracked in micro-ETH and debt in micro-USDT (6 decimals),
    // 1 micro-ETH equals 2000 micro-USDT.
    uint64 public constant ETH_PRICE_MICRO_USDT_PER_MICRO_ETH = 2_000;

    ConfidentialUSDT public immutable cusdt;

    mapping(address user => uint256) private _collateralWei;
    mapping(address user => euint64) private _collateralMicroEth;
    mapping(address user => euint64) private _debtMicroUsdt;

    event Staked(address indexed user, uint256 amountWei, euint64 newCollateralMicroEth);
    event Borrowed(address indexed user, euint64 requestedMicroUsdt, euint64 mintedMicroUsdt, euint64 newDebtMicroUsdt);
    event Repaid(address indexed user, euint64 transferredMicroUsdt, euint64 repaidMicroUsdt, euint64 newDebtMicroUsdt);
    event Withdrawn(address indexed user, uint256 amountWei);

    error ZeroAmount();
    error AmountTooSmall();
    error AmountTooLarge();
    error EthTransferFailed();

    constructor(address cusdt_) {
        require(cusdt_ != address(0), "cusdt is zero");
        cusdt = ConfidentialUSDT(cusdt_);
    }

    function encryptedCollateralOf(address user) external view returns (euint64) {
        return _collateralMicroEth[user];
    }

    function encryptedDebtOf(address user) external view returns (euint64) {
        return _debtMicroUsdt[user];
    }

    function stake() external payable {
        if (msg.value == 0) revert ZeroAmount();

        uint256 deltaMicroEth256 = msg.value / COLLATERAL_SCALE;
        if (deltaMicroEth256 == 0) revert AmountTooSmall();
        if (deltaMicroEth256 > type(uint64).max) revert AmountTooLarge();

        _collateralWei[msg.sender] += msg.value;

        euint64 deltaMicroEthEnc = FHE.asEuint64(uint64(deltaMicroEth256));
        (, euint64 newCollateral) = FHESafeMath.tryIncrease(_collateralMicroEth[msg.sender], deltaMicroEthEnc);

        _collateralMicroEth[msg.sender] = newCollateral;
        FHE.allowThis(newCollateral);
        FHE.allow(newCollateral, msg.sender);

        emit Staked(msg.sender, msg.value, newCollateral);
    }

    function borrow(externalEuint64 encryptedAmount, bytes calldata inputProof) external {
        euint64 requested = FHE.fromExternal(encryptedAmount, inputProof);

        euint64 collateralValueMicroUsdt = FHE.mul(_collateralMicroEth[msg.sender], ETH_PRICE_MICRO_USDT_PER_MICRO_ETH);
        euint64 maxBorrowMicroUsdt = FHE.div(FHE.mul(collateralValueMicroUsdt, MAX_LTV_BPS), BPS);

        euint64 currentDebt = _debtMicroUsdt[msg.sender];
        (ebool hasRemaining, euint64 remainingTmp) = FHESafeMath.tryDecrease(maxBorrowMicroUsdt, currentDebt);
        euint64 remaining = FHE.select(hasRemaining, remainingTmp, FHE.asEuint64(0));

        euint64 toMint = FHE.min(requested, remaining);
        FHE.allowTransient(toMint, address(cusdt));
        euint64 minted = cusdt.mint(msg.sender, toMint);

        (, euint64 newDebt) = FHESafeMath.tryIncrease(currentDebt, minted);
        _debtMicroUsdt[msg.sender] = newDebt;
        FHE.allowThis(newDebt);
        FHE.allow(newDebt, msg.sender);

        emit Borrowed(msg.sender, requested, minted, newDebt);
    }

    function repay(externalEuint64 encryptedAmount, bytes calldata inputProof) external {
        euint64 transferred = cusdt.confidentialTransferFrom(msg.sender, address(this), encryptedAmount, inputProof);
        euint64 burned = cusdt.burn(transferred);

        euint64 currentDebt = _debtMicroUsdt[msg.sender];
        euint64 repaid = FHE.min(burned, currentDebt);
        euint64 newDebt = FHE.sub(currentDebt, repaid);

        _debtMicroUsdt[msg.sender] = newDebt;
        FHE.allowThis(newDebt);
        FHE.allow(newDebt, msg.sender);

        emit Repaid(msg.sender, transferred, repaid, newDebt);
    }

    function withdrawAll() external {
        uint256 amountWei = _collateralWei[msg.sender];
        if (amountWei == 0) revert ZeroAmount();

        _collateralWei[msg.sender] = 0;

        euint64 cleared = FHE.asEuint64(0);
        _collateralMicroEth[msg.sender] = cleared;
        FHE.allowThis(cleared);
        FHE.allow(cleared, msg.sender);

        (bool ok, ) = msg.sender.call{value: amountWei}("");
        if (!ok) revert EthTransferFailed();

        emit Withdrawn(msg.sender, amountWei);
    }

    receive() external payable {
        revert("use stake()");
    }
}

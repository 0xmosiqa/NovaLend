// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";

contract ConfidentialUSDT is ERC7984, ZamaEthereumConfig, Ownable {
    address public minter;

    error UnauthorizedMinter(address caller);

    event MinterUpdated(address indexed oldMinter, address indexed newMinter);

    constructor() ERC7984("cUSDT", "cUSDT", "") Ownable(msg.sender) {
        minter = msg.sender;
    }

    function setMinter(address newMinter) external onlyOwner {
        require(newMinter != address(0), "minter is zero");
        emit MinterUpdated(minter, newMinter);
        minter = newMinter;
    }

    function mint(address to, euint64 amount) external returns (euint64 transferred) {
        if (msg.sender != minter) revert UnauthorizedMinter(msg.sender);
        transferred = _mint(to, amount);
        FHE.allowTransient(transferred, msg.sender);
    }

    function burn(euint64 amount) external returns (euint64 transferred) {
        require(FHE.isAllowed(amount, msg.sender), "unauthorized amount");
        transferred = _burn(msg.sender, amount);
    }
}

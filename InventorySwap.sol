// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/release-v4.9/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/release-v4.9/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/release-v4.9/contracts/token/ERC20/IERC20.sol";

// ERC20 with decimals()
interface IERC20Metadata is IERC20 {
    function decimals() external view returns (uint8);
}

/**
 * Inventory-backed, no-fee, no-slippage swap:
 * - Owner pre-funds tokenOut inventory.
 * - Users swap tokenIn -> tokenOut at an exact rate.
 * - Reverts if inventory insufficient. No partial fills.
 * - Starts PAUSED=true to avoid accidental fills. Unpause when ready.
 *
 * rate is 18-dec fixed: amountOut = amountIn * rate / 1e18
 * Use setHumanRate(mantissa, mantissaDecimals) to set rate without manual math.
 */
contract InventorySwap is Ownable, ReentrancyGuard {
    IERC20Metadata public immutable tokenIn;
    IERC20Metadata public immutable tokenOut;
    uint256 public rate;     // 18-dec fixed: tokenOut per 1 tokenIn
    bool    public paused;   // starts true

    event RateUpdated(uint256 oldRate, uint256 newRate);
    event Paused(bool status);
    event InventoryDeposit(address indexed from, address indexed token, uint256 amount);
    event InventoryWithdraw(address indexed to, address indexed token, uint256 amount);
    event Swapped(address indexed user, uint256 amountIn, uint256 amountOut);

    constructor(address _tokenIn, address _tokenOut)
        Ownable(msg.sender)
    {
        require(_tokenIn != address(0) && _tokenOut != address(0), "addr");
        tokenIn  = IERC20Metadata(_tokenIn);
        tokenOut = IERC20Metadata(_tokenOut);
        paused = true; // SAFE DEFAULT
    }

    // --- Admin ---
    function setPaused(bool _p) external onlyOwner {
        paused = _p;
        emit Paused(_p);
    }

    /**
     * Human-friendly rate setter.
     * If you want price P = tokenOut per 1 tokenIn (e.g., 0.0003),
     * call setHumanRate(mantissa, mantissaDecimals) such that
     *   mantissa / 10^mantissaDecimals = P
     *
     * Internally computes: rate = P * 10^(18 + dOut - dIn)
     * using actual decimals() of tokenIn/tokenOut.
     */
    function setHumanRate(uint256 mantissa, uint8 mantissaDecimals) external onlyOwner {
        require(mantissa > 0, "mantissa=0");
        uint8 dIn  = tokenIn.decimals();
        uint8 dOut = tokenOut.decimals();

        // compute exponent = 18 + dOut - dIn - mantissaDecimals
        // build rate = mantissa * 10^exponent  (if exponent >= 0)
        // or rate = mantissa / 10^(-exponent) (if exponent < 0)
        int256 exponent = int256(uint256(18)) + int256(uint256(dOut)) - int256(uint256(dIn)) - int256(uint256(mantissaDecimals));
        uint256 newRate;
        if (exponent >= 0) {
            newRate = mantissa * (10 ** uint256(exponent));
        } else {
            uint256 pos = uint256(-exponent);
            newRate = mantissa / (10 ** pos);
        }
        require(newRate > 0, "rate=0");

        emit RateUpdated(rate, newRate);
        rate = newRate;
    }

    function depositInventory(uint256 amountOut) external onlyOwner {
        tokenOut.transferFrom(msg.sender, address(this), amountOut);
        emit InventoryDeposit(msg.sender, address(tokenOut), amountOut);
    }

    function withdrawInventory(uint256 amountOut) external onlyOwner {
        tokenOut.transfer(msg.sender, amountOut);
        emit InventoryWithdraw(msg.sender, address(tokenOut), amountOut);
    }

    function withdrawTokenIn(uint256 amount) external onlyOwner {
        tokenIn.transfer(msg.sender, amount);
        emit InventoryWithdraw(msg.sender, address(tokenIn), amount);
    }

    // --- Swap ---
    function swapExactIn(uint256 amountIn) external nonReentrant {
        require(!paused, "paused");
        require(amountIn > 0, "amt");

        // Pull tokenIn from user
        tokenIn.transferFrom(msg.sender, address(this), amountIn);

        // Exact conversion using 18-dec fixed rate
        uint256 amountOut = amountIn * rate / 1e18;

        // Check inventory
        require(tokenOut.balanceOf(address(this)) >= amountOut, "insufficient inventory");

        // Send out
        tokenOut.transfer(msg.sender, amountOut);

        emit Swapped(msg.sender, amountIn, amountOut);
    }

    // --- Helpers ---
    function previewOut(uint256 amountIn) external view returns (uint256) {
        return amountIn * rate / 1e18;
    }
}

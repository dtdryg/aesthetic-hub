// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/security/Pausable.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/IERC20.sol";

/* * This contract enables simple, fixed-rate token swaps. 
 * The owner can dynamically set exchange rates for new token pairs.
 * It uses the 'swapExactIn' pattern common in AMMs.
 * NOTE: For production, this AMM logic would need to be replaced with a highly audited 
 * constant-product or stable-swap formula.
*/
contract ExchangeGateway is Ownable, Pausable {

    // STRUCT to define a trading pair for clean storage
    struct TradingPair {
        address tokenOut; // The asset the user receives (e.g., ADA, DOT)
        uint256 rate;     // The fixed rate (Rate = Input_Token / Output_Token). E.g., 10 means 1 Output token costs 10 Input tokens.
    }

    // Mapping: Input Token Address => Output Token Address => Trading Pair data
    mapping(address => mapping(address => TradingPair)) public tradingPairs;

    // --- Admin/Configuration Functions (OWNER ONLY) ---

    // @dev Adds or updates a trading pair configuration.
    // @param tokenInAddress The address of the token the user pays with (e.g., USDC).
    // @param tokenOutAddress The address of the token the user receives (e.g., ADA).
    // @param rateInPerOut The fixed rate (e.g., 10 if 1 Output costs 10 Input tokens).
    function setTradingPair(
        address tokenInAddress,
        address tokenOutAddress,
        uint256 rateInPerOut
    ) public onlyOwner {
        require(tokenInAddress != tokenOutAddress, "Tokens cannot be the same");
        require(rateInPerOut > 0, "Rate must be positive");
        
        tradingPairs[tokenInAddress][tokenOutAddress] = TradingPair({
            tokenOut: tokenOutAddress,
            rate: rateInPerOut
        });
        emit PairUpdated(tokenInAddress, tokenOutAddress, rateInPerOut);
    }
    
    event PairUpdated(address indexed tokenIn, address indexed tokenOut, uint256 rate);
    
    // @dev Pauses the contract in an emergency.
    function emergencyPause() public onlyOwner {
        _pause();
    }

    // @dev Unpauses the contract.
    function emergencyUnpause() public onlyOwner {
        _unpause();
    }

    // --- Core Trading Functions (READ) ---

    // @dev Previews the amount of tokenOut received for a given amount of tokenIn.
    // Note: Assumes tokenIn and tokenOut use the same decimal scale for this simple example.
    function previewOut(
        address tokenInAddress,
        address tokenOutAddress,
        uint256 amountIn
    ) public view returns (uint256 amountOut) {
        TradingPair memory pair = tradingPairs[tokenInAddress][tokenOutAddress];
        require(pair.rate > 0, "Pair not configured or rate is zero");
        
        // Simple fixed-rate calculation: amountOut = amountIn / rate
        amountOut = amountIn / pair.rate;
    }

    // --- Core Trading Functions (WRITE) ---

    // @dev Executes the swap.
    function swapExactIn(
        address tokenInAddress,
        address tokenOutAddress,
        uint256 amountIn,
        uint256 amountOutMin // Minimum tokenOut user expects to receive (slippage control)
    ) public payable whenNotPaused {
        
        TradingPair memory pair = tradingPairs[tokenInAddress][tokenOutAddress];
        require(pair.rate > 0, "Pair not configured or rate is zero");

        // 1. Calculate output
        uint256 calculatedOut = amountIn / pair.rate;
        require(calculatedOut >= amountOutMin, "Slippage tolerance exceeded");

        // 2. Transfer tokens IN (Requires prior approval via ERC20 approve function)
        IERC20(tokenInAddress).transferFrom(msg.sender, address(this), amountIn);

        // 3. Transfer tokens OUT
        IERC20(tokenOutAddress).transfer(msg.sender, calculatedOut);

        emit SwapExecuted(msg.sender, tokenInAddress, tokenOutAddress, amountIn, calculatedOut);
    }

    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
}
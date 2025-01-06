const { MiraClient } = require('@mira-amm/mira-v1-ts');
require('dotenv').config();

// Initialize MIRA client with configuration
const miraClient = new MiraClient({
  rpcUrl: 'https://rpc.mira.ly', // Use the appropriate RPC URL for MIRA
});

// Function to fetch token price
async function getTokenPrice(tokenAddress) {
  try {
    const tokenData = await miraClient.getTokenData(tokenAddress);
    return {
      name: tokenData.name,
      symbol: tokenData.symbol,
      price: tokenData.price,
    };
  } catch (error) {
    console.error('Error fetching token price:', error.message);
    throw new Error('Could not fetch token price.');
  }
}

// Function to execute token swap
async function swapTokens(fromToken, toToken, amount, userAddress, slippage = 1) {
  try {
    const tx = await miraClient.swap({
      fromToken,
      toToken,
      amount,
      slippage,
      userAddress,
    });
    return tx;
  } catch (error) {
    console.error('Error during token swap:', error.message);
    throw new Error('Swap failed.');
  }
}

// Function to get user's portfolio
async function getPortfolio(userAddress) {
  try {
    const portfolio = await miraClient.getPortfolio(userAddress);
    return portfolio.map((token) => ({
      symbol: token.symbol,
      balance: token.balance,
    }));
  } catch (error) {
    console.error('Error fetching portfolio:', error.message);
    throw new Error('Could not fetch portfolio.');
  }
}

// Function to handle buying tokens
async function handleBuyToken(contractAddress, amountInEth, slippage, userAddress) {
  try {
    const result = await swapTokens('ETH', contractAddress, amountInEth, userAddress, slippage);
    return `Successfully bought tokens!\nTransaction Hash: ${result.transactionHash}`;
  } catch (error) {
    console.error('Error buying tokens:', error.message);
    return 'Failed to buy tokens. Please check your input and try again.';
  }
}

// Function to handle selling tokens
async function handleSellToken(contractAddress, amountInTokens, userAddress) {
  try {
    const result = await swapTokens(contractAddress, 'ETH', amountInTokens, userAddress, 1);
    return `Successfully sold tokens!\nTransaction Hash: ${result.transactionHash}`;
  } catch (error) {
    console.error('Error selling tokens:', error.message);
    return 'Failed to sell tokens. Please check your input and try again.';
  }
}

module.exports = {
  getTokenPrice,
  swapTokens,
  getPortfolio,
  handleBuyToken,
  handleSellToken,
};

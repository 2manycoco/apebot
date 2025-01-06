import { Telegraf } from 'telegraf';
import fetch from 'node-fetch';
import { handleBuyToken, handleSellToken } from './TokenUtils.js'; // Assuming TokenUtils.js is set up for buying/selling
import { getTokenPrice, swapTokens, getPortfolio } from './MiraClient.js'; // New file for Mira interactions
import dotenv from 'dotenv'; // Import dotenv

dotenv.config(); // Load environment variables from .env

// Initialize bot with the token from environment variables
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// GraphQL endpoint for Fuel
const fuelGraphQLURL = 'http://mainnet.fuel.network/v1/graphql';

// Portfolio data (this should be dynamic based on actual user data)
const userPortfolio = {
  tokens: [],
  fuelTokens: 100,
  profitLoss: 200,
};

// Function to fetch Fuel network chain info
async function fetchChainInfo() {
  const query = `
    query {
      chain {
        name
        latestBlock {
          id
          height
        }
      }
    }
  `;
  try {
    const response = await fetch(fuelGraphQLURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
    const data = await response.json();
    if (data.data && data.data.chain) {
      const chain = data.data.chain;
      const chainName = chain.name || 'Unknown Name';
      const latestBlock = chain.latestBlock || { id: 'N/A', height: 'N/A' };
      return `Fuel Chain Info:\nName: ${chainName}\nLatest Block ID: ${latestBlock.id}\nHeight: ${latestBlock.height}`;
    } else {
      return 'Error: Chain data is unavailable.';
    }
  } catch (error) {
    console.error('Error fetching chain info:', error);
    return 'Error fetching chain info.';
  }
}

// Bot commands
bot.command('start', async (ctx) => {
  ctx.reply('Welcome! Type /help to see available commands.');
});

bot.command('help', async (ctx) => {
  ctx.reply(`
    Here are some commands you can use:
    - /start - Start the bot
    - /help - List commands
    - /portfolio - View your portfolio
    - /fuel_info - View Fuel network chain info
    - /price <token_address> - Get the token price
    - /health - Check Fuel network health
    - /start_trading - Start trading session
    - /add_token - Add a token address
    - /buy <contract_address> <amount_in_eth> <slippage> - Buy a token
    - /sell <contract_address> <amount_in_tokens> - Sell a token
  `);
});

bot.command('portfolio', async (ctx) => {
  if (userPortfolio.tokens.length > 0) {
    const portfolioInfo = userPortfolio.tokens
      .map((token) => `Token: ${token.name}\nBalance: ${token.balance}`)
      .join('\n\n');
    ctx.reply(`Your Portfolio:\n${portfolioInfo}`);
  } else {
    ctx.reply('Your portfolio is empty.');
  }
});

bot.command('fuel_info', async (ctx) => {
  const chainInfo = await fetchChainInfo();
  ctx.reply(chainInfo || 'Error fetching Fuel chain info.');
});

bot.command('price', async (ctx) => {
  const tokenAddress = ctx.message.text.split(' ')[1];
  if (tokenAddress) {
    try {
      const priceData = await getTokenPrice(tokenAddress);
      ctx.reply(`Token Price:\nName: ${priceData.name}\nSymbol: ${priceData.symbol}\nPrice: ${priceData.price}`);
    } catch (error) {
      ctx.reply('Error fetching token price.');
    }
  } else {
    ctx.reply('Please provide a token address. Example: /price <token_address>');
  }
});

bot.command('health', async (ctx) => {
  const health = await fetchHealth();
  ctx.reply(`Fuel Network Health: ${health}`);
});

bot.command('start_trading', async (ctx) => {
  ctx.reply('Starting trading session...');
  // Trigger Mira DEX-related functionalities like buy/sell here
});

bot.command('add_token', async (ctx) => {
  const tokenAddress = ctx.message.text.split(' ')[1];
  if (tokenAddress) {
    ctx.reply(`Token address ${tokenAddress} has been added.`);
    // Logic to add token to the user's portfolio can go here
  } else {
    ctx.reply('Please provide a token address to add. Example: /add_token <token_address>');
  }
});

bot.command('buy', async (ctx) => {
  const [contract, amount, slippage] = ctx.message.text.split(' ').slice(1);
  if (contract && amount && slippage) {
    try {
      // Use your private key for signing transactions securely
      const result = await swapTokens(contract, 'TO_TOKEN_ADDRESS', amount, process.env.USER_ADDRESS, slippage); // Replace 'TO_TOKEN_ADDRESS' with the actual token address
      ctx.reply(result || 'Error occurred while buying the token.');
    } catch (error) {
      ctx.reply('Error during token swap.');
    }
  } else {
    ctx.reply('Usage: /buy <contract_address> <amount_in_eth> <slippage>');
  }
});

bot.command('sell', async (ctx) => {
  const [contract, amount] = ctx.message.text.split(' ').slice(1);
  if (contract && amount) {
    try {
      // Use your private key for signing transactions securely
      const result = await swapTokens(contract, 'FROM_TOKEN_ADDRESS', amount, process.env.USER_ADDRESS); // Replace 'FROM_TOKEN_ADDRESS' with the actual token address
      ctx.reply(result || 'Error occurred while selling the token.');
    } catch (error) {
      ctx.reply('Error during token swap.');
    }
  } else {
    ctx.reply('Usage: /sell <contract_address> <amount_in_tokens>');
  }
});

// Launch the bot
bot.launch();

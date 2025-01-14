import {WalletUnlocked} from "fuels";

export async function showBalances(wallet: WalletUnlocked, label: string): Promise<void> {
    console.log(`${label}:`);
    const balances = await wallet.getBalances();
    balances.balances.forEach((balance) => {
        console.log(`Asset ID: ${balance.assetId} | Balance: ${balance.amount.toString()}`);
    });
}
import {
    AssetId,
    BN,
    Provider,
    TransactionResult,
    WalletUnlocked
} from "fuels";
import {DexInterface} from "../dex.interface";
import {buildPoolId, getLPAssetId, MiraAmm, PoolId, ReadonlyMiraAmm} from "mira-dex-ts";
import {
    futureDeadline,
    getServiceFee
} from "../../fuel/functions";
import {TokenInfo} from "../model";
import {retry} from "../../utils/call_helper";
import {CONTRACTS} from "../../fuel/asset/contracts";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config();
dotenv.config({path: path.resolve(__dirname, "../../.env.secret")});

const MIRA_POOL_TOKEN_SYMBOL = "MIRA-LP"
const POOL_NOT_FOUND_ERROR = "Pool not found";
const POOL_NOT_PRESENTED_ERROR = "Pool not present";
const contractId = process.env.MIRA_CONTRACT_ID;

const scalingFactor = new BN(10000);

export class MiraDex implements DexInterface {
    private readonly wallet: WalletUnlocked;
    private readonly miraAmm: MiraAmm;
    private readonly readonlyMiraAmm: ReadonlyMiraAmm;

    constructor(wallet: WalletUnlocked) {
        this.wallet = wallet;
        this.miraAmm = new MiraAmm(wallet, contractId);
        this.readonlyMiraAmm = new ReadonlyMiraAmm(wallet.provider, contractId);
    }

    async getTokenInfo(assetId: AssetId): Promise<TokenInfo> {
        const poolId = buildPoolId(CONTRACTS.ASSET_ETH, assetId, false);
        const lpAssetId = getLPAssetId(contractId, poolId);
        const assetInfo = await retry(
            async () => await this.readonlyMiraAmm.lpAssetInfo(lpAssetId)
        );

        if (!assetInfo) {
            throw new Error(`Token info not found for asset ID: ${assetId.bits}`);
        }

        // Handle 'MIRA-LP' case
        let symbol = assetInfo.symbol || "Unknown";
        if (symbol === MIRA_POOL_TOKEN_SYMBOL) {
            // Extract the first part of the name (before the '-') using regex
            const match = assetInfo.name.match(/^([^-]+)-/);
            symbol = match ? match[1].trim() : assetInfo.name;
        }

        return {
            assetId: assetId.bits,
            name: assetInfo.name?.toString() || "Unknown",
            symbol: symbol?.toString(),
            decimals: assetInfo.decimals || 0,
            isBounded: true,
            isFuelTrade: true
        };
    }

    async getSwapAmount(assetIn: AssetId, assetOut: AssetId, amount: BN): Promise<BN> {
        return this.handlePoolNotFound(
            async (pools) => this.readonlyMiraAmm.previewSwapExactInput(assetIn, amount, pools),
            assetIn,
            assetOut
        ).then(([_, amountOut]) => {
            if (!amountOut || !(amountOut instanceof BN) || amountOut.lte(new BN(0))) {
                throw new Error(`Invalid swap amount returned for assetIn: ${assetIn.bits}, assetOut: ${assetOut.bits}, amount: ${amount.toString()}`);
            }
            return amountOut;
        });
    }

    async swap(assetIn: AssetId, assetOut: AssetId, amount: BN, slippage: number): Promise<TransactionResult> {
        const txRequest = await this.handlePoolNotFound(
            async (pools) => {
                const {
                    amountWithoutFees,
                    amountCalculated
                } = await this.calculateAmountOutMin(assetIn, assetOut, amount, pools.length, slippage);

                const txParams = {
                    gasLimit: new BN(999999),
                    maxFee: new BN(999999),
                    tip: new BN(200),
                };

                let retries = 0;
                const maxRetries = 2;
                while (true) {
                    const deadline = await futureDeadline(this.wallet.provider);

                    try {
                        return retry(() => {
                            return this.miraAmm.swapExactInput(
                                amount,
                                assetIn,
                                amountCalculated,
                                pools,
                                deadline,
                                txParams
                            )
                        }, 3)
                    } catch (e) {
                        if (retries < maxRetries) {
                            txParams.gasLimit = txParams.gasLimit.mul(new BN(110)).div(new BN(100));
                            txParams.maxFee = txParams.maxFee.mul(new BN(110)).div(new BN(100));
                            retries++;
                        } else {
                            throw e
                        }
                    }
                }
            },
            assetIn,
            assetOut
        );

        const txCost = await this.wallet.getTransactionCost(txRequest);
        txRequest.gasLimit = txCost.gasUsed.mul(new BN(105)).div(new BN(100));
        txRequest.maxFee = txCost.maxFee.mul(new BN(105)).div(new BN(100));
        await this.wallet.fund(txRequest, txCost);

        const tx = await this.wallet.sendTransaction(txRequest);

        return await retry(async () => tx.waitForResult());
    }

    async getRate(assetIn: AssetId, assetOut: AssetId): Promise<number> {
        return this.handlePoolNotFound(
            async (pools) => this.readonlyMiraAmm.getCurrentRate(assetIn, pools),
            assetIn,
            assetOut
        ).then(([rate, assetInDecimals, assetOutDecimals]) => {
            if (rate <= 0) {
                throw new Error(`Invalid rate returned for assetIn: ${assetIn.bits}, assetOut: ${assetOut.bits}`);
            }

            const scaleFactor = Math.pow(10, assetOutDecimals - assetInDecimals);
            return rate * scaleFactor;
        });
    }

    async calculateAmountOutMin(
        assetIn: AssetId,
        assetOut: AssetId,
        amount: BN,
        poolsCount: number,
        slippage: number
    ): Promise<{ amountWithoutFees: BN; amountCalculated: BN }> {
        const expectedAmountOut = await this.getSwapAmount(assetIn, assetOut, amount);

        const serviceFee = getServiceFee()
        const slippageBP = new BN(Math.floor(slippage * 100));

        const totalPercentage = slippageBP.add(serviceFee).mul(poolsCount);

        const amountAfterAllDeductions = expectedAmountOut
            .mul(scalingFactor.sub(totalPercentage))
            .div(scalingFactor);

        if (amountAfterAllDeductions.lte(new BN(0))) {
            throw new Error('Adjusted amountOutMin is less than or equal to 0 after subtracting fees and slippage.');
        }

        return {
            amountWithoutFees: expectedAmountOut,
            amountCalculated: amountAfterAllDeductions,
        };
    }


    private createETHRoute(assetIn: AssetId, assetOut: AssetId): PoolId[] {
        const poolInEthId = buildPoolId(assetIn, CONTRACTS.ASSET_ETH, false);
        const poolOutEthId = buildPoolId(assetOut, CONTRACTS.ASSET_ETH, false);
        return [poolInEthId, poolOutEthId]
    }

    private createUSDCRoute(assetIn: AssetId, assetOut: AssetId): PoolId[] {
        const poolInEthId = buildPoolId(assetIn, CONTRACTS.ASSET_USDC, false);
        const poolOutEthId = buildPoolId(assetOut, CONTRACTS.ASSET_USDC, false);
        return [poolInEthId, poolOutEthId]
    }

    private async handlePoolNotFound<T>(
        fn: (pools: PoolId[]) => Promise<T>,
        assetIn: AssetId,
        assetOut: AssetId
    ): Promise<T> {
        const directPool = [buildPoolId(assetIn, assetOut, false)];
        try {
            return await retry(() => fn(directPool));
        } catch (error: any) {
            if (typeof error.message === "string") {
                if (error.message.includes(POOL_NOT_FOUND_ERROR)) {
                    const ethRoute = this.createETHRoute(assetIn, assetOut);
                    return await retry(() => fn(ethRoute));
                } else if (error.message.includes(POOL_NOT_PRESENTED_ERROR)) {
                    const usdcRoute = this.createUSDCRoute(assetIn, assetOut);
                    return await retry(() => fn(usdcRoute));
                }
            }
            throw error;
        }
    }

}
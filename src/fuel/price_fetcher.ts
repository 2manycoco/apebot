import axios from "axios";
import { CONTRACTS } from "./asset/contracts";
import {formatTokenNumber} from "../bot/help_functions";
import {retry} from "../utils/call_helper";

interface CryptoPrice {
    price: number;
    change24h: number;
}

export class CryptoPriceFetcher {
    private static instance: CryptoPriceFetcher;
    private readonly apiUrl = "https://api.coingecko.com/api/v3/simple/price";
    private readonly assets = ["ethereum", "fuel-network"];
    private readonly currency = "usd";
    private prices: Record<string, CryptoPrice> = {};
    private updateInterval: NodeJS.Timeout | null = null;

    private constructor() {
        this.startAutoUpdate();
    }

    public static getInstance(): CryptoPriceFetcher {
        if (!CryptoPriceFetcher.instance) {
            CryptoPriceFetcher.instance = new CryptoPriceFetcher();
        }
        return CryptoPriceFetcher.instance;
    }

    private async fetchPrices(): Promise<void> {
        try {
            const response = await retry(async ()=> {
                return await axios.get(this.apiUrl, {
                    params: {
                        ids: this.assets.join(","),
                        vs_currencies: this.currency,
                        include_24hr_change: true,
                    },
                });
            });

            const data = response.data;
            for (const asset of this.assets) {
                if (data[asset]) {
                    this.prices[asset.toUpperCase()] = {
                        price: data[asset][this.currency],
                        change24h: data[asset][`${this.currency}_24h_change`],
                    };
                }
            }
        } catch (error) {
            console.error("Error fetching crypto prices:", error.message);
        }
    }

    private startAutoUpdate(): void {
        this.updateInterval = setInterval(async () => {
            await this.fetchPrices();
        }, 60 * 1000);

        this.fetchPrices().catch((error) => console.error("Initial fetch error:", error.message));
    }

    public stopAutoUpdate(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    public getPrice(symbol: string): CryptoPrice | null {
        const idMapping: Record<string, string> = {
            ETH: "ETHEREUM",
            FUEL: "FUEL-NETWORK",
        };
        const mappedSymbol = idMapping[symbol.toUpperCase()];
        return mappedSymbol ? this.prices[mappedSymbol] || null : null;
    }
}

export function generatePriceMessage(): string {
    const ethPrice = CryptoPriceFetcher.getInstance().getPrice(CONTRACTS.ASSET_ETH.symbol);
    const fuelPrice = CryptoPriceFetcher.getInstance().getPrice(CONTRACTS.ASSET_FUEL.symbol);

    const arrow = (change: number) => (change >= 0 ? "📈" : "📉");
    const formatChange = (change: number) =>
        `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;

    const ethMessage = ethPrice
        ? `Eth ${formatTokenNumber(ethPrice.price)}$${ethPrice.change24h !== undefined ? ` (${formatChange(ethPrice.change24h)} 24h ${arrow(ethPrice.change24h)})` : ""}`
        : "Eth price not available";

    const fuelMessage = fuelPrice
        ? `Fuel ${formatTokenNumber(fuelPrice.price)}$${fuelPrice.change24h !== undefined ? ` (${formatChange(fuelPrice.change24h)} 24h ${arrow(fuelPrice.change24h)})` : ""}`
        : "Fuel price not available";

    return `${ethMessage}\n${fuelMessage}`;
}

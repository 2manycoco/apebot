export interface LatestAssetData {
    asset_id: string;
    asset_img: string;
    asset_name: string;
    asset_symbol: string;
    contract_id: string;
    description: string;
    status: string;
    twitter_link: string | null;
    telegram_link: string | null;
    website_link: string | null;
    created_by: string;
    created_at: string;
    market_cap: string;
    network_type: string;
    community_takeover: boolean;
    native_token: string;
}

export class LatestAsset {
    assetId: string;
    assetImg: string;
    assetName: string;
    assetSymbol: string;
    contractId: string;
    description: string;
    status: string;
    twitterLink: string | null;
    telegramLink: string | null;
    websiteLink: string | null;
    createdBy: string;
    createdAt: Date;
    marketCap: string;
    networkType: string;
    communityTakeover: boolean;
    nativeToken: string;

    constructor(data: LatestAssetData) {
        this.assetId = data.asset_id;
        this.assetImg = data.asset_img;
        this.assetName = data.asset_name;
        this.assetSymbol = data.asset_symbol;
        this.contractId = data.contract_id;
        this.description = data.description;
        this.status = data.status;
        this.twitterLink = data.twitter_link;
        this.telegramLink = data.telegram_link;
        this.websiteLink = data.website_link;
        this.createdBy = data.created_by;
        this.createdAt = new Date(data.created_at);
        this.marketCap = data.market_cap;
        this.networkType = data.network_type;
        this.communityTakeover = data.community_takeover;
        this.nativeToken = data.native_token;
    }

    public toString(): string {
        return `${this.assetName} (${this.assetSymbol}) - ID: ${this.assetId}`;
    }

    public static fromJSON(json: any): LatestAsset {
        return new LatestAsset(json);
    }
}

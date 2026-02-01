export interface Asset {
    id: string;
    name: string;
    code: string;
    decimals: number;
    address: string;
    blockchain: {
        id: number;
        name: string;
    };
}

export interface Institution {
    code: string;
    name: string;
    icon?: string;
}

export interface Beneficiary {
    id?: number;
    userId: number;
    holderName: string;
    bankCode: string; // For offramp
    accountNumber: string; // For offramp
    bankName: string; // Helper for UI
    walletAddress?: string; // For onramp (if we save them later)
}

export enum TransactionType {
    ONRAMP = 'ONRAMP',
    OFFRAMP = 'OFFRAMP'
}

export interface Quote {
    rate: number;
    expiry: string;
    settlement: string;
    fee: {
        total: number;
        platform: number;
        developer: number;
        currency: string;
    };
    source: {
        amount: number;
        currency: string;
    };
    destination: {
        amount: number;
        currency: string;
    };
}

// Session data extension for Telegraf
export interface SessionData {
    onramp?: {
        asset?: Asset;
        country?: string;
        amount?: number;
        quote?: Quote;
        walletAddress?: string;
    };
    offramp?: {
        asset?: Asset;
        country?: string;
        amount?: number;
        quote?: Quote;
        beneficiary?: Beneficiary;
    };
}

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
    fee?: {
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

export interface Coverage {
    direction: 'ONRAMP' | 'OFFRAMP';
    country: string;
    currency: string;
    banks: Institution[];
}

export interface FieldRequirement {
    path: string;
    regex: string;
    example: string;
    hint: string;
    option: { name: string; code: string }[];
}

export interface TransactionResult {
    id: string;
    status: string;
    type: string;
    reference: string;
    source: {
        amount: number;
        currency: string;
    };
    destination: {
        amount: number;
        currency: string;
    };
    deposit: {
        bank_name?: string;
        bank_code?: string;
        account_name?: string;
        account_number?: string;
        address?: string;
        asset?: string;
        note?: string[];
    };
    created_at: string;
}

// Session data extension for Telegraf
export interface SessionData {
    onramp?: {
        asset?: Asset;
        country?: string;
        amount?: number;
        quote?: Quote;
        walletAddress?: string;
        result?: TransactionResult;
    };
    offramp?: {
        asset?: Asset;
        country?: string;
        amount?: number;
        quote?: Quote;
        beneficiary?: Beneficiary;
        result?: TransactionResult;
    };
}

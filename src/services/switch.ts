import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { Asset, Institution, Quote } from '../types';

export class SwitchService {
    private api: AxiosInstance;
    private useMock: boolean = true; // Defaulting to mock for now due to auth issues

    constructor() {
        this.api = axios.create({
            baseURL: config.switch.baseUrl,
            headers: {
                'Authorization': `Bearer ${config.switch.apiKey}`,
                'Content-Type': 'application/json',
            },
        });
    }

    async getAssets(): Promise<Asset[]> {
        if (this.useMock) {
            return [
                {
                    id: "base:usdc",
                    name: "USD Coin",
                    code: "USDC",
                    decimals: 6,
                    address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
                    blockchain: { id: 8453, name: "Base" }
                },
                {
                    id: "ethereum:usdc",
                    name: "USD Coin",
                    code: "USDC",
                    decimals: 6,
                    address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                    blockchain: { id: 1, name: "Ethereum" }
                }
            ];
        }

        try {
            const response = await this.api.get('/asset');
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        } catch (error: any) {
            console.error('Error fetching assets:', error.response?.data || error.message);
            throw error;
        }
    }

    async getInstitutions(country: string): Promise<Institution[]> {
        if (this.useMock) {
            return [
                { code: "058", name: "Guaranty Trust Bank" },
                { code: "011", name: "First Bank of Nigeria" },
                { code: "044", name: "Access Bank" }
            ];
        }

        try {
            const response = await this.api.get(`/institution?country=${country}`);
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        } catch (error: any) {
            console.error('Error fetching institutions:', error.response?.data || error.message);
            throw error;
        }
    }

    async lookupInstitution(country: string, bankCode: string, accountNumber: string): Promise<{ account_name: string }> {
        if (this.useMock) {
            return { account_name: "Zappy Mock User" };
        }

        try {
            const response = await this.api.post('/institution/lookup', {
                country,
                beneficiary: {
                    bank_code: bankCode,
                    account_number: accountNumber,
                },
            });
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        } catch (error: any) {
            console.error('Error looking up institution:', error.response?.data || error.message);
            throw error;
        }
    }

    async getOnrampQuote(amount: number, country: string, asset: string, currency: string = 'NGN'): Promise<Quote> {
        if (this.useMock) {
            const rate = 1500;
            return {
                rate,
                expiry: new Date(Date.now() + 300000).toISOString(),
                settlement: "Instant",
                fee: { total: 5, platform: 4, developer: 1, currency: "NGN" },
                source: { amount, currency },
                destination: { amount: amount / rate, currency: "USDC" }
            };
        }

        try {
            const response = await this.api.post('/onramp/quote', {
                amount,
                country,
                asset,
                currency,
                channel: 'BANK', // Default to Bank for now
                exact_output: false,
                developer_fee: 1, // 1% fee
            });
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        } catch (error: any) {
            console.error('Error fetching onramp quote:', error.response?.data || error.message);
            throw error;
        }
    }

    async initiateOnramp(data: {
        amount: number;
        country: string;
        asset: string;
        walletAddress: string;
        currency?: string;
    }): Promise<any> {
        if (this.useMock) {
            return {
                status: "PENDING",
                reference: "MOCK-" + Date.now(),
                deposit: {
                    bank_name: "Mock Bank",
                    account_number: "9988776655",
                    account_name: "Switch Onramp",
                    note: "Ref: ZappyBot"
                }
            };
        }

        try {
            const response = await this.api.post('/onramp/initiate', {
                amount: data.amount,
                country: data.country,
                currency: data.currency || 'NGN',
                asset: data.asset,
                beneficiary: {
                    wallet_address: data.walletAddress,
                    holder_type: "INDIVIDUAL",
                    holder_name: "Zappy User"
                },
                channel: 'BANK',
                reason: 'REMITTANCES', // Default reason
                developer_fee: 1, // 1% fee
            });
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        } catch (error: any) {
            console.error('Error initiating onramp:', error.response?.data || error.message);
            throw error;
        }
    }

    async getOfframpQuote(amount: number, country: string, asset: string, currency: string = 'NGN'): Promise<Quote> {
        if (this.useMock) {
            const rate = 1480;
            return {
                rate,
                expiry: new Date(Date.now() + 300000).toISOString(),
                settlement: "Instant",
                fee: { total: 1, platform: 0.8, developer: 0.2, currency: "USDC" },
                source: { amount, currency: "USDC" },
                destination: { amount: amount * rate, currency }
            };
        }

        try {
            const response = await this.api.post('/offramp/quote', {
                amount,
                country,
                asset,
                currency,
                channel: 'BANK',
                exact_output: false,
                developer_fee: 1, // 1% fee
            });
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        } catch (error: any) {
            console.error('Error fetching offramp quote:', error.response?.data || error.message);
            throw error;
        }
    }

    async initiateOfframp(data: {
        amount: number;
        country: string;
        asset: string;
        accessToken?: string; // If needed later
        beneficiary: {
            bankCode: string;
            accountNumber: string;
            holderName: string;
        };
        currency?: string;
    }): Promise<any> {
        if (this.useMock) {
            return {
                status: "AWAITING_DEPOSIT",
                reference: "MOCK-OFF-" + Date.now(),
                deposit: {
                    amount: data.amount,
                    address: "0xMOCKDEPOSITADDRESS123456789",
                    asset: data.asset,
                    note: ["Send exact amount"]
                }
            };
        }

        try {
            const response = await this.api.post('/offramp/initiate', {
                amount: data.amount,
                country: data.country,
                currency: data.currency || 'NGN',
                asset: data.asset,
                beneficiary: {
                    holder_type: "INDIVIDUAL",
                    holder_name: data.beneficiary.holderName,
                    account_number: data.beneficiary.accountNumber,
                    bank_code: data.beneficiary.bankCode
                },
                channel: 'BANK',
                reason: 'REMITTANCES',
                developer_fee: 1, // 1% fee
            });
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        } catch (error: any) {
            console.error('Error initiating offramp:', error.response?.data || error.message);
            throw error;
        }
    }
}

export const switchService = new SwitchService();

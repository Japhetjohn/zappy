import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { Asset, Institution, Quote } from '../types';

export class SwitchService {
    private api: AxiosInstance;
    private useMock: boolean = false;

    constructor() {
        this.api = axios.create({
            baseURL: config.switch.baseUrl,
            headers: {
                'x-service-key': config.switch.apiKey,
                'Content-Type': 'application/json',
            },
        });
    }

    async getAssets(): Promise<Asset[]> {
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

    async getCoverage(direction: 'ONRAMP' | 'OFFRAMP', country?: string): Promise<any[]> {
        try {
            const url = country ? `/coverage?direction=${direction}&country=${country}` : `/coverage?direction=${direction}`;
            const response = await this.api.get(url);
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        } catch (error: any) {
            console.error('Error fetching coverage:', error.response?.data || error.message);
            throw error;
        }
    }

    async getRequirement(direction: 'ONRAMP' | 'OFFRAMP', country: string, currency?: string): Promise<any[]> {
        try {
            const url = currency ? `/requirement?direction=${direction}&country=${country}&currency=${currency}` : `/requirement?direction=${direction}&country=${country}`;
            const response = await this.api.get(url);
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        } catch (error: any) {
            console.error('Error fetching requirements:', error.response?.data || error.message);
            throw error;
        }
    }

    async getInstitutions(country: string): Promise<Institution[]> {
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

    async lookupInstitution(country: string, bankCode: string, accountNumber: string): Promise<any> {
        try {
            const payload = {
                country,
                beneficiary: {
                    bank_code: bankCode,
                    account_number: accountNumber.trim(),
                }
            };
            console.log('Sending Switch Lookup Payload:', JSON.stringify(payload));

            const response = await this.api.post('/institution/lookup', payload);
            console.log('Switch API Lookup Response:', JSON.stringify(response.data));

            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message || 'Failed to lookup account');
        } catch (error: any) {
            const apiMessage = error.response?.data?.message || error.response?.data?.error;
            const finalMessage = apiMessage ? `${apiMessage}` : error.message;
            console.error('Error looking up institution:', error.response?.data || error.message);
            throw new Error(finalMessage);
        }
    }

    async getOnrampQuote(amount: number, country: string, asset: string, currency: string = 'NGN', developerFee?: number): Promise<Quote> {
        try {
            const response = await this.api.post('/onramp/quote', {
                amount,
                country,
                asset,
                currency,
                channel: 'BANK',
                developer_fee: developerFee !== undefined ? developerFee : config.developerFee,
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
        holderName?: string;
        currency?: string;
        senderBankCode?: string;
        senderAccountNumber?: string;
        developerFee?: number;
    }): Promise<any> {
        try {
            // Sanitize holder name...
            const sanitizedName = data.holderName
                ? data.holderName.replace(/[^a-zA-Z\s'-]/g, '').trim() || 'Crypto Buyer'
                : 'Crypto Buyer';

            const payload: any = {
                amount: data.amount,
                country: data.country,
                currency: data.currency || 'NGN',
                asset: data.asset,
                beneficiary: {
                    wallet_address: data.walletAddress,
                    holder_type: "INDIVIDUAL",
                    holder_name: sanitizedName
                },
                channel: 'BANK',
                reason: 'REMITTANCES',
                developer_fee: data.developerFee !== undefined ? data.developerFee : config.developerFee,
                // Add developer wallet for fee collection (Solana/Single-Wallet mode)
                developer_wallet: config.developerWallet || 'GMaeFMXrbxTfS2e83B92YticnGYKdF4DaG5FWjL25tNV',
            };

            // Pass sender details if available to help with reconciliation/VA generation
            if (data.senderBankCode && data.senderAccountNumber) {
                payload.sender = {
                    bank_code: data.senderBankCode,
                    account_number: data.senderAccountNumber,
                    name: sanitizedName,
                    country: data.country, // Add country to sender details
                };
            }

            const response = await this.api.post('/onramp/initiate', payload);
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        } catch (error: any) {
            console.error('Error initiating onramp:', error.response?.data || error.message);
            throw error;
        }
    }

    async getOfframpQuote(amount: number, country: string, asset: string, currency: string = 'NGN', developerFee?: number): Promise<Quote> {
        try {
            const response = await this.api.post('/offramp/quote', {
                amount,
                country,
                asset,
                currency,
                channel: 'BANK',
                developer_fee: developerFee !== undefined ? developerFee : config.developerFee,
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
        beneficiary: {
            bankCode: string;
            accountNumber: string;
            holderName: string;
        };
        currency?: string;
        developerFee?: number;
    }): Promise<any> {
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
                developer_fee: data.developerFee !== undefined ? data.developerFee : config.developerFee,
                developer_wallet: config.developerWallet
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

    async getStatus(reference: string): Promise<any> {
        try {
            const response = await this.api.get(`/status?reference=${reference}`);
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        } catch (error: any) {
            console.error('Error fetching status:', error.response?.data || error.message);
            throw error;
        }
    }

    async getRates(): Promise<{ buy: number, sell: number }> {
        try {
            // Estimate Buy Rate: How much NGN for 1 USDT? 
            // We quote for a standard amount like 100,000 NGN to get a realistic rate including fees
            const buyQuote = await this.getOnrampQuote(100000, 'NG', 'ethereum:usdt', 'NGN');
            // rate = paid_amount / received_amount
            const buyRate = buyQuote.source.amount / buyQuote.destination.amount;

            // Estimate Sell Rate: How much NGN for 1 USDT?
            const sellQuote = await this.getOfframpQuote(100, 'NG', 'ethereum:usdt', 'NGN');
            // rate = received_amount / sent_amount
            const sellRate = sellQuote.destination.amount / sellQuote.source.amount;

            return {
                buy: Math.round(buyRate),
                sell: Math.round(sellRate)
            };
        } catch (error: any) {
            console.error('Error fetching rates:', error.message);
            // Fallback estimation if API fails (just so bot doesn't crash)
            return { buy: 0, sell: 0 };
        }
    }

    async confirmDeposit(reference: string, hash?: string): Promise<any> {
        try {
            const payload: any = { reference };
            if (hash) payload.hash = hash;

            const response = await this.api.post('/confirm', payload);
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        } catch (error: any) {
            console.error('Error confirming deposit:', error.response?.data || error.message);
            throw error;
        }
    }
}

export const switchService = new SwitchService();

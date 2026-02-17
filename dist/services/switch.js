"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.switchService = exports.SwitchService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config");
class SwitchService {
    constructor() {
        this.useMock = false;
        this.api = axios_1.default.create({
            baseURL: config_1.config.switch.baseUrl,
            headers: {
                'x-service-key': config_1.config.switch.apiKey,
                'Content-Type': 'application/json',
            },
        });
    }
    async getAssets() {
        var _a;
        try {
            const response = await this.api.get('/asset');
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        }
        catch (error) {
            console.error('Error fetching assets:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            throw error;
        }
    }
    async getCoverage(direction, country) {
        var _a;
        try {
            const url = country ? `/coverage?direction=${direction}&country=${country}` : `/coverage?direction=${direction}`;
            const response = await this.api.get(url);
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        }
        catch (error) {
            console.error('Error fetching coverage:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            throw error;
        }
    }
    async getRequirement(direction, country, currency) {
        var _a;
        try {
            const url = currency ? `/requirement?direction=${direction}&country=${country}&currency=${currency}` : `/requirement?direction=${direction}&country=${country}`;
            const response = await this.api.get(url);
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        }
        catch (error) {
            console.error('Error fetching requirements:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            throw error;
        }
    }
    async getInstitutions(country) {
        var _a;
        try {
            const response = await this.api.get(`/institution?country=${country}`);
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        }
        catch (error) {
            console.error('Error fetching institutions:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            throw error;
        }
    }
    async lookupInstitution(country, bankCode, accountNumber) {
        var _a, _b, _c, _d, _e;
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
        }
        catch (error) {
            const apiMessage = ((_b = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || ((_d = (_c = error.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.error);
            const finalMessage = apiMessage ? `${apiMessage}` : error.message;
            console.error('Error looking up institution:', ((_e = error.response) === null || _e === void 0 ? void 0 : _e.data) || error.message);
            throw new Error(finalMessage);
        }
    }
    async getOnrampQuote(amount, country, asset, currency = 'NGN', developerFee) {
        var _a;
        try {
            const payload = {
                amount,
                country,
                asset,
                currency,
                channel: 'BANK',
                developer_fee: developerFee !== undefined ? developerFee : config_1.config.developerFee,
            };
            console.log('--- DEBUG: ONRAMP QUOTE REQUEST ---');
            console.log(JSON.stringify(payload, null, 2));
            const response = await this.api.post('/onramp/quote', payload);
            console.log('--- DEBUG: ONRAMP QUOTE RESPONSE ---');
            console.log(JSON.stringify(response.data, null, 2));
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        }
        catch (error) {
            console.error('Error fetching onramp quote:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            throw error;
        }
    }
    async initiateOnramp(data) {
        var _a;
        try {
            let sanitizedName = data.holderName
                ? data.holderName.replace(/[^a-zA-Z\s'-]/g, '').trim()
                : '';
            if (!sanitizedName || sanitizedName.length < 2) {
                sanitizedName = 'User';
            }
            const payload = {
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
                developer_fee: data.developerFee !== undefined ? data.developerFee : config_1.config.developerFee,
                developer_wallet: config_1.config.developerWallet || 'GMaeFMXrbxTfS2e83B92YticnGYKdF4DaG5FWjL25tNV',
            };
            if (data.senderBankCode && data.senderAccountNumber) {
                payload.sender = {
                    bank_code: data.senderBankCode,
                    account_number: data.senderAccountNumber,
                    name: sanitizedName,
                    country: data.country,
                };
            }
            const response = await this.api.post('/onramp/initiate', payload);
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        }
        catch (error) {
            console.error('Error initiating onramp:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            throw error;
        }
    }
    async getOfframpQuote(amount, country, asset, currency = 'NGN', developerFee) {
        var _a;
        try {
            const response = await this.api.post('/offramp/quote', {
                amount,
                country,
                asset,
                currency,
                channel: 'BANK',
                developer_fee: developerFee !== undefined ? developerFee : config_1.config.developerFee,
            });
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        }
        catch (error) {
            console.error('Error fetching offramp quote:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            throw error;
        }
    }
    async initiateOfframp(data) {
        var _a;
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
                developer_fee: data.developerFee !== undefined ? data.developerFee : config_1.config.developerFee,
                developer_wallet: config_1.config.developerWallet
            });
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        }
        catch (error) {
            console.error('Error initiating offramp:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            throw error;
        }
    }
    async getStatus(reference) {
        var _a;
        try {
            const response = await this.api.get(`/status?reference=${reference}`);
            console.log('--- DEBUG: STATUS RESPONSE ---');
            console.log(JSON.stringify(response.data, null, 2));
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        }
        catch (error) {
            console.error('Error fetching status:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            throw error;
        }
    }
    async getRates() {
        try {
            const buyQuote = await this.getOnrampQuote(100000, 'NG', 'ethereum:usdt', 'NGN');
            const buyRate = buyQuote.source.amount / buyQuote.destination.amount;
            const sellQuote = await this.getOfframpQuote(100, 'NG', 'ethereum:usdt', 'NGN');
            const sellRate = sellQuote.destination.amount / sellQuote.source.amount;
            return {
                buy: Math.round(buyRate),
                sell: Math.round(sellRate)
            };
        }
        catch (error) {
            console.error('Error fetching rates:', error.message);
            return { buy: 0, sell: 0 };
        }
    }
    async confirmDeposit(reference, hash) {
        var _a;
        try {
            const payload = { reference };
            if (hash)
                payload.hash = hash;
            const response = await this.api.post('/confirm', payload);
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        }
        catch (error) {
            console.error('Error confirming deposit:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            throw error;
        }
    }
    async getDeveloperFees() {
        var _a;
        try {
            const response = await this.api.get('/developer/fees');
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        }
        catch (error) {
            console.error('Error fetching developer fees:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            throw error;
        }
    }
    async withdrawDeveloperFees(asset, walletAddress) {
        var _a;
        try {
            const payload = {
                asset,
                beneficiary: {
                    wallet_address: walletAddress
                }
            };
            const response = await this.api.post('/withdraw', payload);
            if (response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        }
        catch (error) {
            console.error('Error withdrawing developer fees:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            throw error;
        }
    }
}
exports.SwitchService = SwitchService;
exports.switchService = new SwitchService();
//# sourceMappingURL=switch.js.map
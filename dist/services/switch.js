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
    async getOnrampQuote(amount, country, asset, currency = 'NGN') {
        var _a;
        try {
            const response = await this.api.post('/onramp/quote', {
                amount,
                country,
                asset,
                currency,
                channel: 'BANK',
                developer_fee: 1,
            });
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
                reason: 'REMITTANCES',
                developer_fee: 1,
            });
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
    async getOfframpQuote(amount, country, asset, currency = 'NGN') {
        var _a;
        try {
            const response = await this.api.post('/offramp/quote', {
                amount,
                country,
                asset,
                currency,
                channel: 'BANK',
                developer_fee: 1,
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
                developer_fee: 1,
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
    async confirmDeposit(reference) {
        var _a;
        try {
            const response = await this.api.post('/confirm', { reference });
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
}
exports.SwitchService = SwitchService;
exports.switchService = new SwitchService();
//# sourceMappingURL=switch.js.map
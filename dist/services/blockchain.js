"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.blockchainService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("../utils/logger"));
const RPC_URL = 'https://api.mainnet-beta.solana.com';
exports.blockchainService = {
    findIncomingTx: async (address) => {
        try {
            const sigResponse = await axios_1.default.post(RPC_URL, {
                jsonrpc: '2.0',
                id: 1,
                method: 'getSignaturesForAddress',
                params: [
                    address,
                    { limit: 10 }
                ]
            });
            if (!sigResponse.data || !sigResponse.data.result || sigResponse.data.result.length === 0) {
                return null;
            }
            const signatures = sigResponse.data.result;
            for (const sig of signatures) {
                try {
                    const txResponse = await axios_1.default.post(RPC_URL, {
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'getTransaction',
                        params: [
                            sig.signature,
                            { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }
                        ]
                    });
                    if (txResponse.data && txResponse.data.result && txResponse.data.result.meta) {
                        const meta = txResponse.data.result.meta;
                        const preBalances = meta.preTokenBalances || [];
                        const postBalances = meta.postTokenBalances || [];
                        const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
                        let isIncoming = false;
                        postBalances.forEach((post) => {
                            if (post.mint === usdcMint) {
                                const pre = preBalances.find((p) => p.accountIndex === post.accountIndex);
                                const preAmount = pre ? pre.uiTokenAmount.uiAmount : 0;
                                const postAmount = post.uiTokenAmount.uiAmount || 0;
                                if (postAmount > preAmount) {
                                    isIncoming = true;
                                }
                            }
                        });
                        if (isIncoming) {
                            logger_1.default.info(`[Blockchain] Found valid transfer hash: ${sig.signature}`);
                            return sig.signature;
                        }
                    }
                }
                catch (txError) {
                    logger_1.default.warn(`[Blockchain] Failed to parse tx ${sig.signature}: ${txError.message}`);
                    continue;
                }
            }
            return null;
        }
        catch (error) {
            logger_1.default.error(`Blockchain Scan Error for ${address}: ${error.message}`);
            return null;
        }
    }
};
//# sourceMappingURL=blockchain.js.map
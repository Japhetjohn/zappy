
import axios from 'axios';
import logger from '../utils/logger';

const RPC_URL = 'https://api.mainnet-beta.solana.com';

export const blockchainService = {
    /**
     * Scans the given address for any recent incoming USDC transfer.
     * Returns the signature of the first valid transfer found.
     */
    findIncomingTx: async (address: string): Promise<string | null> => {
        try {
            // 1. Get recent signatures (up to 10 to be safe)
            const sigResponse = await axios.post(RPC_URL, {
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

            // 2. Iterate through signatures to find an actual transfer
            for (const sig of signatures) {
                try {
                    const txResponse = await axios.post(RPC_URL, {
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

                        // Check for positive balance change in USDC mint
                        const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

                        let isIncoming = false;

                        postBalances.forEach((post: any) => {
                            if (post.mint === usdcMint) {
                                const pre = preBalances.find((p: any) => p.accountIndex === post.accountIndex);
                                const preAmount = pre ? pre.uiTokenAmount.uiAmount : 0;
                                const postAmount = post.uiTokenAmount.uiAmount || 0;

                                // If balance increased, it's an incoming transfer
                                // (We assume the dynamic wallet is the receiver)
                                if (postAmount > preAmount) {
                                    isIncoming = true;
                                }
                            }
                        });

                        if (isIncoming) {
                            logger.info(`[Blockchain] Found valid transfer hash: ${sig.signature}`);
                            return sig.signature;
                        }
                    }
                } catch (txError: any) {
                    logger.warn(`[Blockchain] Failed to parse tx ${sig.signature}: ${txError.message}`);
                    continue;
                }
            }

            return null;

        } catch (error: any) {
            logger.error(`Blockchain Scan Error for ${address}: ${error.message}`);
            return null;
        }
    }
};

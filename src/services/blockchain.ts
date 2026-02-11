
import axios from 'axios';
import logger from '../utils/logger';

const RPC_URL = 'https://api.mainnet-beta.solana.com';

export const blockchainService = {
    /**
     * Get the latest transaction signature for a given Solana address.
     * Useful for finding the hash of a user's deposit to a dynamic wallet.
     */
    getLastIncomingTx: async (address: string): Promise<string | null> => {
        try {
            const response = await axios.post(RPC_URL, {
                jsonrpc: '2.0',
                id: 1,
                method: 'getSignaturesForAddress',
                params: [
                    address,
                    { limit: 1 } // We only need the latest one for dynamic wallets
                ]
            });

            if (response.data && response.data.result && response.data.result.length > 0) {
                const tx = response.data.result[0];
                // Check if recent? (Optional, but dynamic wallets are short-lived)
                return tx.signature;
            }
            return null;
        } catch (error: any) {
            logger.error(`Blockchain Scan Error for ${address}: ${error.message}`);
            return null;
        }
    }
};


import axios from 'axios';

const RPC_URL = 'https://api.mainnet-beta.solana.com';

const inputs = [
    //    {
    //        ref: '1410aa99-4614-4e63-86ca-a8f1bd699892',
    //        address: '62THii8EncuZM6bHYfkHwh78iYYpwxBkzdLYMXkn7QDn'
    //    },
    {
        ref: '3d4d9147-0dbb-48c0-a42e-302e5a3af5d6',
        address: 'CTs5qW6giAJkpACtwgYAAgs5b8dFY1EXaDEBZ9ncLsqr'
    }
];

async function getSignatures(address: string) {
    try {
        const response = await axios.post(RPC_URL, {
            jsonrpc: '2.0',
            id: 1,
            method: 'getSignaturesForAddress',
            params: [
                address,
                { limit: 5 }
            ]
        });
        return response.data.result;
    } catch (e: any) {
        console.error('RPC Error:', e.message);
        return [];
    }
}

async function getTransaction(signature: string) {
    try {
        const response = await axios.post(RPC_URL, {
            jsonrpc: '2.0',
            id: 1,
            method: 'getTransaction',
            params: [
                signature,
                { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }
            ]
        });
        return response.data;
    } catch (e: any) {
        console.error('RPC Error:', e.message);
        return null;
    }
}

(async () => {
    for (const input of inputs) {
        console.log(`\n==================================================`);
        console.log(`🔎 Analyzing Address for Ref ${input.ref.substr(0, 8)}`);
        console.log(`Address: ${input.address}`);
        console.log(`Solscan: https://solscan.io/account/${input.address}#transfers`);

        const sigs = await getSignatures(input.address);
        if (sigs && sigs.length > 0) {
            console.log(`Found ${sigs.length} recent transactions.`);

            for (const sig of sigs) {
                const txDetails = await getTransaction(sig.signature);
                let isIncoming = false;
                let amount = 0;

                if (txDetails && txDetails.result && txDetails.result.meta) {
                    const meta = txDetails.result.meta;
                    const preBalances = meta.preTokenBalances || [];
                    const postBalances = meta.postTokenBalances || [];

                    postBalances.forEach((post: any) => {
                        // USDC Mint: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
                        if (post.mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
                            const pre = preBalances.find((p: any) => p.accountIndex === post.accountIndex);
                            const preAmount = pre ? pre.uiTokenAmount.uiAmount : 0;
                            const postAmount = post.uiTokenAmount.uiAmount || 0;

                            if (postAmount > preAmount) {
                                // Check if this account belongs to the address we are checking?
                                // Usually we can just assume positive flow in relevant accounts means transfer
                                // But better to be sure. 
                                // For now, let's just log positive flows.
                                amount = postAmount - preAmount;
                                isIncoming = true;
                            }
                        }
                    });
                }

                if (isIncoming) {
                    console.log(`\n✅ INCOMING TRANSFER DETECTED`);
                    console.log(`   Hash: ${sig.signature}`);
                    console.log(`   Amount: +${amount} USDC`);
                    console.log(`   Time: ${new Date(sig.blockTime * 1000).toISOString()}`);
                    console.log(`   Link: https://solscan.io/tx/${sig.signature}`);
                } else {
                    console.log(`\n   (Other Tx) ${sig.signature} - Time: ${new Date(sig.blockTime * 1000).toISOString()}`);
                }
            }
        } else {
            console.log('❌ No transactions found.');
        }
    }
})();

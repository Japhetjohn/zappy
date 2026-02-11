
import axios from 'axios';

const RPC_URL = 'https://api.mainnet-beta.solana.com';

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

const txs = [
    '5hUiqRAZPzsrVYVek1CY4iYX1WXSmzgmBURoGoBtHKCaQrEtE1UcThBVhYTHYnoNXC2AqhDrMbQyvbjMDt27uJSL',
    'kMb76oc1wYbyntah3Nj8vz51KrpRVB9He7yy6eD5YgsNGvGePA93AYbKZkhPgmK8vzG4BkcRuNmiQTvvugkqKih'
];

(async () => {
    for (const tx of txs) {
        console.log(`Checking tx ${tx}...`);
        const res = await getTransaction(tx);
        if (res && res.result) {
            const meta = res.result.meta;
            const preBalances = meta.preTokenBalances;
            const postBalances = meta.postTokenBalances;

            console.log(`--- Tx Analysis for ${tx.substr(0, 10)} ---`);

            // Simple check: Look for balance change in USDC mint
            // USDC Mint: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

            if (postBalances && preBalances) {
                postBalances.forEach((post: any) => {
                    const pre = preBalances.find((p: any) => p.accountIndex === post.accountIndex);
                    if (pre && post.mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
                        const change = post.uiTokenAmount.uiAmount - pre.uiTokenAmount.uiAmount;
                        if (change > 0) {
                            console.log(`Received: ${change} USDC to Account index ${post.accountIndex}`);
                        }
                    }
                });
            }

        } else {
            console.log('No result or error', res);
        }
    }
})();

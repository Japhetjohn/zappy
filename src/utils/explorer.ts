export const getExplorerLink = (assetId: string, hash: string): string => {
    if (!assetId || !hash) return '';

    const network = assetId.split(':')[0].toLowerCase();

    const explorers: Record<string, string> = {
        // Short prefixes (from Switch API asset IDs like "bsc:usdc")
        'bsc':      `https://bscscan.com/tx/${hash}`,
        'eth':      `https://etherscan.io/tx/${hash}`,
        'sol':      `https://solscan.io/tx/${hash}`,
        'tron':     `https://tronscan.org/#/transaction/${hash}`,
        'trx':      `https://tronscan.org/#/transaction/${hash}`,
        'matic':    `https://polygonscan.com/tx/${hash}`,
        'poly':     `https://polygonscan.com/tx/${hash}`,
        'arb':      `https://arbiscan.io/tx/${hash}`,
        'base':     `https://basescan.org/tx/${hash}`,
        'avax':     `https://snowtrace.io/tx/${hash}`,
        'op':       `https://optimistic.etherscan.io/tx/${hash}`,
        // Full names (for backwards compatibility)
        'ethereum': `https://etherscan.io/tx/${hash}`,
        'solana':   `https://solscan.io/tx/${hash}`,
        'polygon':  `https://polygonscan.com/tx/${hash}`,
        'arbitrum': `https://arbiscan.io/tx/${hash}`,
        'optimism': `https://optimistic.etherscan.io/tx/${hash}`,
        'avalanche':`https://snowtrace.io/tx/${hash}`,
        'gnosis':   `https://gnosisscan.io/tx/${hash}`,
    };

    return explorers[network] || `https://blockscan.com/tx/${hash}`;
};

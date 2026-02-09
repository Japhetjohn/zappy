export const getExplorerLink = (assetId: string, hash: string): string => {
    if (!assetId || !hash) return '';

    const network = assetId.split(':')[0].toLowerCase();

    switch (network) {
        case 'ethereum':
            return `https://etherscan.io/tx/${hash}`;
        case 'bsc':
            return `https://bscscan.com/tx/${hash}`;
        case 'solana':
            return `https://solscan.io/tx/${hash}`;
        case 'tron':
            return `https://tronscan.org/#/transaction/${hash}`;
        case 'polygon':
            return `https://polygonscan.com/tx/${hash}`;
        case 'arbitrum':
            return `https://arbiscan.io/tx/${hash}`;
        case 'optimism':
            return `https://optimistic.etherscan.io/tx/${hash}`;
        case 'avalanche':
            return `https://snowtrace.io/tx/${hash}`;
        case 'gnosis':
            return `https://gnosisscan.io/tx/${hash}`;
        default:
            return '';
    }
};

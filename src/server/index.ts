import express, { Request, Response } from 'express';
import { bot } from '../bot';
import { storageService } from '../services/storage';
import { switchService } from '../services/switch';
import { notificationService } from '../services/notification';
import { blockchainService } from '../services/blockchain';
import { config } from '../config';
import logger from '../utils/logger';
import { getExplorerLink } from '../utils'; // Import explorer utility

const app = express();
app.use(express.json());

// 🩺 Health Check Endpoints
app.get('/health', (req: Request, res: Response) => {
    res.status(200).send({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/', (req: Request, res: Response) => {
    res.status(200).send('Bitnova Africa Bot Server is Running ⚡️');
});

// --- Admin API ---
const adminAuth = (req: Request, res: Response, next: express.NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${config.adminPassword}`) {
        logger.warn(`Unauthorized admin access attempt from ${req.ip}`);
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    next();
};

app.get('/api/admin/stats', adminAuth, async (req: Request, res: Response) => {
    try {
        const rates = await switchService.getRates().catch(() => ({ buy: 1500, sell: 1500 }));
        const rate = (rates.buy + rates.sell) / 2 || 1500;

        // Use live rate for stats calculation
        const stats = storageService.getStats(rate) as any;

        // Fetch real-time developer fees (earnings) from Switch API
        try {
            const fees = await switchService.getDeveloperFees();
            stats.developerFees = fees;
        } catch (e) {
            logger.warn(`Failed to fetch developer fees for stats: ${e.message}`);
            stats.developerFees = { amount: 0, currency: 'USDC' };
        }

        res.json(stats);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/transactions', adminAuth, (req: Request, res: Response) => {
    try {
        const txs = storageService.getAdminTransactions();
        res.json(txs);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/transactions/:reference', adminAuth, (req: Request, res: Response): any => {
    try {
        const reference = req.params.reference as string;
        const tx = storageService.getTransactionDetails(reference);
        if (!tx) return res.status(404).json({ error: 'Transaction not found' });
        return res.json(tx);
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});
app.post('/api/admin/transactions/:reference/confirm', adminAuth, async (req: Request, res: Response): Promise<any> => {
    try {
        const reference = req.params.reference as string;
        const tx = storageService.getTransaction(reference);
        if (!tx) return res.status(404).json({ error: 'Transaction not found' });

        logger.info(`🚨 Admin Auto-Confirm triggered for ${reference}`);

        let hashToUse = req.body.hash; // Still allow manual override if provided (fallback)

        // 1. Check current status from Switch API first
        try {
            const status = await switchService.getStatus(reference);
            logger.info(`[AutoConfirm] Switch Status: ${status.status}, Hash: ${status.hash || 'None'}`);

            // If already completed or verified on Switch, just sync it
            if (['COMPLETED', 'VERIFIED', 'PROCESSING'].includes(status.status)) {
                const finalHash = status.hash || status.txHash || status.transactionHash || hashToUse || tx.hash;
                storageService.updateTransactionStatus(reference, status.status, finalHash);

                // Trigger notification if completed
                if (status.status === 'COMPLETED') {
                    await notificationService.sendUpdate(tx.user_id, reference, 'COMPLETED', tx.asset, tx.amount, finalHash);
                }

                return res.json({ success: true, message: `Synced status: ${status.status}`, data: status });
            }

            // 2. If OFFRAMP and AWAITING_DEPOSIT, scan blockchain for hash if missing
            if (tx.type === 'OFFRAMP' && (status.status === 'AWAITING_DEPOSIT' || tx.status === 'AWAITING_DEPOSIT')) {
                if (!hashToUse && !status.hash) {
                    logger.info(`[AutoConfirm] Scanning blockchain for incoming tx to ${status.deposit?.address}...`);
                    if (status.deposit?.address) {
                        const foundHash = await blockchainService.findIncomingTx(status.deposit.address);
                        if (foundHash) {
                            logger.info(`[AutoConfirm] Found blockchain hash: ${foundHash}`);
                            hashToUse = foundHash;
                        }
                    }
                }
            }
        } catch (e: any) {
            logger.warn(`[AutoConfirm] Status check failed: ${e.message}`);
        }

        // 3. Attempt Confirmation with found hash
        if (!hashToUse && tx.hash) hashToUse = tx.hash; // Use existing DB hash if available

        const result = await switchService.confirmDeposit(reference, hashToUse);

        // 4. Update Status & Notify
        const newStatus = result.status || 'PROCESSING';
        storageService.updateTransactionStatus(reference, newStatus, hashToUse);

        // Notify user immediately that we are processing
        await notificationService.sendUpdate(tx.user_id, reference, newStatus, tx.asset, tx.amount, hashToUse);

        return res.json({ success: true, data: result });
    } catch (e: any) {
        logger.error(`Manual confirmation failed for ${req.params.reference}: ${e.message}`);
        return res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/transactions/:reference/cancel', adminAuth, async (req: Request, res: Response): Promise<any> => {
    try {
        const reference = req.params.reference as string;
        const tx = storageService.getTransaction(reference);
        if (!tx) return res.status(404).json({ error: 'Transaction not found' });

        // Update status to CANCELLED
        storageService.updateTransactionStatus(reference, 'CANCELLED');

        // Notify user
        await notificationService.sendUpdate(
            tx.user_id,
            reference,
            'CANCELLED',
            tx.asset,
            tx.amount,
            undefined,
            'Transaction cancelled by admin.'
        );

        return res.json({ success: true });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/users', adminAuth, async (req: Request, res: Response) => {
    try {
        const rates = await switchService.getRates().catch(() => ({ buy: 1500, sell: 1500 }));
        const rate = (rates.buy + rates.sell) / 2 || 1500;
        const users = storageService.getUserProcessingStats(rate);
        res.json(users);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/users/:id/details', adminAuth, async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.id as string);
        const rates = await switchService.getRates().catch(() => ({ buy: 1500, sell: 1500 }));
        const rate = (rates.buy + rates.sell) / 2 || 1500;
        const details = storageService.getUserDetailStats(userId, rate);
        res.json(details);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/users/:id/transactions', adminAuth, (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.id as string);
        const txs = storageService.getUserTransactions(userId);
        res.json(txs);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Withdraw Developer Fees ---
app.post('/api/admin/withdraw', adminAuth, async (req: Request, res: Response): Promise<any> => {
    try {
        const SOLANA_WALLET = config.developerWallet || 'GMaeFMXrbxTfS2e83B92YticnGYKdF4DaG5FWjL25tNV';
        const asset = req.body.asset || 'solana:usdc';

        // First check available fees
        const fees = await switchService.getDeveloperFees();
        if (!fees.amount || fees.amount <= 0) {
            return res.status(400).json({ error: 'No fees available to withdraw', available: fees });
        }

        logger.info(`💸 Admin initiated fee withdrawal: ${fees.amount} ${fees.currency} -> ${SOLANA_WALLET} as ${asset}`);

        // Execute withdrawal
        const result = await switchService.withdrawDeveloperFees(asset, SOLANA_WALLET);

        logger.info(`✅ Fee withdrawal successful: ${JSON.stringify(result)}`);
        return res.json({
            success: true,
            message: 'Withdrawal initiated successfully',
            data: {
                ...result,
                wallet: SOLANA_WALLET,
                asset,
            }
        });
    } catch (e: any) {
        logger.error(`❌ Fee withdrawal failed: ${e.message}`);
        return res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/settings', adminAuth, (req: Request, res: Response) => {
    try {
        const settings = storageService.getSettings();
        res.json(settings);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/settings', adminAuth, (req: Request, res: Response) => {
    try {
        const { key, value } = req.body;
        if (!key || value === undefined) throw new Error('Key and value required');
        storageService.updateSetting(key, value.toString());
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Serve Admin Dashboard Static Files
import path from 'path';
const publicPath = path.resolve(process.cwd(), 'public');
logger.info(`🚨 SERVING STATIC FROM: ${publicPath}`);

// Serve the admin folder at /admin and /admin/
app.use('/admin', express.static(path.join(publicPath, 'admin')));

// Ultimate fallback for /admin paths to handle front-end routing if any
app.get(['/admin', '/admin/*'], (req, res) => {
    res.sendFile(path.join(publicPath, 'admin/index.html'));
});

app.post('/webhook', async (req: Request, res: Response) => {
    const payload = req.body;
    logger.info(`Incoming Webhook: ${JSON.stringify(payload)}`);

    try {
        const { reference, status, message } = payload;

        if (!reference) {
            return res.status(400).send({ success: false, message: 'Missing reference' });
        }

        const transaction = storageService.getTransaction(reference);
        if (!transaction) {
            logger.warn(`Webhook received for unknown transaction: ${reference}`);
            return res.status(404).send({ success: false, message: 'Transaction not found' });
        }

        const txHash = payload.hash || payload.txHash || payload.transactionHash || payload.tx_hash || payload.blockchain_tx_id || payload.transaction_id;

        // Update database status
        storageService.updateTransactionStatus(reference, status, txHash);

        // Notify user via shared service - only for critical updates
        const notifiableStatuses = ['VERIFIED', 'COMPLETED', 'FAILED', 'EXPIRED'];
        if (notifiableStatuses.includes(status)) {
            // Fetch extra data for a richer notification if possible
            let extra: any = { type: transaction.type };
            if (status === 'COMPLETED' || status === 'VERIFIED') {
                const txDetail = storageService.getTransactionDetails(reference);
                if (txDetail) {
                    extra.destinationAmount = txDetail.destination_amount;
                    extra.destinationCurrency = txDetail.destination_currency;
                    extra.rate = txDetail.rate;
                }
            }

            await notificationService.sendUpdate(
                transaction.user_id,
                reference,
                status,
                transaction.asset,
                transaction.amount,
                txHash,
                message,
                extra
            );
        }

        return res.send({ success: true });
    } catch (error: any) {
        logger.error(`Webhook handling failed: ${error.message}`);
        return res.status(500).send({ success: false, message: error.message });
    }
});

import { startScheduler } from '../services/scheduler';

export function startServer() {
    const port = config.port;
    app.listen(port, () => {
        logger.info(`🌐 Webhook server listening on port ${port}`);

        // Start background tasks
        startScheduler();

        // 🚀 Self-Ping Mechanism (Prevents sleeping on render/railway/etc)
        const selfUrl = config.baseUrl || `http://localhost:${port}`;
        logger.info(`⏰ Self-ping scheduled for: ${selfUrl} (every 60s)`);

        const axios = require('axios');
        setInterval(async () => {
            try {
                await axios.get(`${selfUrl}/health`);
                // Only log errors to avoid cluttering logs
            } catch (e: any) {
                logger.warn(`💓 Heartbeat failed for ${selfUrl}: ${e.message}`);
            }
        }, 60000); // Check every minute
    });
}

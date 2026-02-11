
import { storageService } from '../src/services/storage';

console.log('Testing History Fetch...');
try {
    // arbitrary user ID, or pass one
    const userId = 7253292072; // from logs
    const history = storageService.getTransactionHistory(userId);
    console.log(`Found ${history.length} transactions.`);
    console.log(JSON.stringify(history, null, 2));
} catch (e: any) {
    console.error('Error fetching history:', e.message);
    console.error(e.stack);
}

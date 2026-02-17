
import { switchService } from '../src/services/switch';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkFees() {
    console.log('🔍 Checking Developer Fees...');
    try {
        const fees = await switchService.getDeveloperFees();
        console.log('--- Developer Fees ---');
        console.log(JSON.stringify(fees, null, 2));
    } catch (e: any) {
        console.error('❌ Error:', e.message);
        if (e.response) {
            console.error('Response Data:', e.response.data);
        }
    }
}

checkFees();

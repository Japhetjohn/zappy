import { switchService } from '../src/services/switch';
import dotenv from 'dotenv';
dotenv.config();

async function testLookup() {
    console.log('--- Testing Switch API Account Lookup ---');
    const country = 'NG';
    const bankCode = '058';
    const accountNumber = '0123456789';

    try {
        const result = await switchService.lookupInstitution(country, bankCode, accountNumber);
        console.log('✅ Result:', JSON.stringify(result, null, 2));
    } catch (error: any) {
        console.log('❌ Lookup Failed (Expected for placeholder)');
    }
}

testLookup();

import { switchService } from '../src/services/switch';
import dotenv from 'dotenv';
dotenv.config();

async function testQuote() {
    console.log('--- Testing Switch API Quote Response ---');
    try {
        console.log('Fetching assets...');
        const assets = await switchService.getAssets();
        const usdc = assets.find(a => a.code === 'USDC' || a.code === 'USDT');

        if (!usdc) {
            console.error('❌ No USDC/USDT asset found.');
            return;
        }

        console.log('Fetching coverage for ONRAMP...');
        const coverage = await switchService.getCoverage('ONRAMP');
        const ng = coverage.find(c => c.country === 'NG');

        if (!ng) {
            console.error('❌ Nigeria (NG) not found in coverage.');
            return;
        }
        console.log('RAW Nigeria coverage object:', JSON.stringify(ng, null, 2));

        const currency = Array.isArray(ng.currency) ? ng.currency[0] : ng.currency;
        console.log(`Using currency: ${currency}`);

        console.log('Fetching Quote...');
        const quote = await switchService.getOnrampQuote(
            5000,
            ng.country,
            usdc.id,
            currency
        );

        console.log('✅ Quote Response Structure:');
        console.log(JSON.stringify(quote, null, 2));

    } catch (error: any) {
        console.error('❌ Test FAILED');
    }
}

testQuote();

import { switchService } from '../src/services/switch';
import dotenv from 'dotenv';
dotenv.config();

async function testConnectivity() {
    console.log('--- Testing Switch API Connectivity ---');
    try {
        console.log('Fetching assets...');
        const assets = await switchService.getAssets();
        console.log('✅ Assets fetched:', assets.length);
        console.log('First asset:', assets[0]);

        console.log('Fetching coverage for ONRAMP...');
        const coverage = await switchService.getCoverage('ONRAMP');
        console.log('✅ Coverage fetched:', coverage.length);
        console.log('First country:', coverage[0].country);

        console.log('Connectivity test PASSED! 🚀');
    } catch (error: any) {
        console.error('❌ Connectivity test FAILED:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Message:', error.message);
        }
        process.exit(1);
    }
}

testConnectivity();

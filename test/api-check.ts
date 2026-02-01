import { switchService } from '../src/services/switch';

async function testApi() {
    try {
        console.log('Testing Switch API...');

        console.log('Fetching assets...');
        const assets = await switchService.getAssets();
        console.log(`Successfully fetched ${assets.length} assets.`);
        console.log('First asset:', assets[0]);

        console.log('Fetching institutions for Nigeria...');
        const institutions = await switchService.getInstitutions('NG');
        console.log(`Successfully fetched ${institutions.length} institutions.`);
        console.log('First institution:', institutions[0]);

        console.log('API Verification Successful!');
    } catch (error) {
        console.error('API Verification Failed:', error);
    }
}

testApi();

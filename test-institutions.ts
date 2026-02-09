import { switchService } from './src/services/switch';

async function test() {
    try {
        console.log('Fetching institutions...');
        const banks = await switchService.getInstitutions('NG');
        console.log('Institutions:', JSON.stringify(banks, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

test();

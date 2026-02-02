import { switchService } from '../src/services/switch';
import dotenv from 'dotenv';
dotenv.config();

async function testOfframpDetails() {
    console.log('--- Testing Switch API Offramp Requirements & Banks ---');
    try {
        console.log('1. Fetching coverage for OFFRAMP...');
        const coverage = await switchService.getCoverage('OFFRAMP');
        const ng = coverage.find(c => c.country === 'NG');

        if (!ng) {
            console.error('❌ Nigeria (NG) not found in coverage.');
            return;
        }
        const currency = Array.isArray(ng.currency) ? ng.currency[0] : ng.currency;
        console.log(`Using: country=NG, currency=${currency}`);

        console.log('\n2. Fetching requirements for OFFRAMP...');
        const requirements = await switchService.getRequirement('OFFRAMP', 'NG', currency);
        console.log('✅ REQ Response Structure:');
        console.log(JSON.stringify(requirements, null, 2));

        console.log('\n3. Fetching institutions for NG...');
        const banks = await switchService.getInstitutions('NG');
        console.log('✅ Banks fetched:', banks.length);
        if (banks.length > 0) {
            console.log('Sample Bank:', JSON.stringify(banks[0], null, 2));
        }

    } catch (error: any) {
        console.error('❌ Test FAILED');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('Message:', error.message);
        }
    }
}

testOfframpDetails();

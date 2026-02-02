import { switchService } from '../src/services/switch';
import dotenv from 'dotenv';
dotenv.config();

async function findOPay() {
    try {
        console.log('Fetching institutions for Nigeria...');
        const institutions = await switchService.getInstitutions('NG');
        const opay = institutions.filter(inst =>
            inst.name.toLowerCase().includes('opay') ||
            inst.name.toLowerCase().includes('digital') ||
            inst.name.toLowerCase().includes('paycom')
        );

        console.log('Found results:', JSON.stringify(opay, null, 2));
    } catch (error: any) {
        console.error('Error fetching institutions:', error.message);
    }
}

findOPay();

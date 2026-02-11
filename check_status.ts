
import { switchService } from './src/services/switch';
import { config } from './src/config';

console.log('API Key:', config.switch.apiKey ? 'Set' : 'Missing');
console.log('Base URL:', config.switch.baseUrl);

const ref = '60b42278-5e75-4391-989a-3eafdc346299';

(async () => {
    try {
        console.log(`Checking status for ${ref}...`);
        const status = await switchService.getStatus(ref);
        console.log('Status Response:', JSON.stringify(status, null, 2));
    } catch (e: any) {
        console.error('Error:', e.message);
        if (e.response) {
            console.error('API Error Data:', JSON.stringify(e.response.data, null, 2));
        }
    }
})();

import { switchService } from './src/services/switch';

async function test() {
    try {
        console.log('Fetching assets...');
        const assets = await switchService.getAssets();
        console.log('Assets:', JSON.stringify(assets, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

test();

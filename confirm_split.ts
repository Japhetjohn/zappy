
import { switchService } from './src/services/switch';

const update = {
    reference: "3d4d9147-0dbb-48c0-a42e-302e5a3af5d6",
    hash: "67XGg1u7vkoeVKsL2ka5Wt6e6jJ7JFi1PEKmaoC2JQ9UM8bav5CdPjLsmYq9PGP3pc7b1jGg49Z6mSMuKBqvqGMP"
};

(async () => {
    console.log(`\n🚀 Sending /confirm for split payment (Second Hash)...`);
    console.log(`Ref: ${update.reference}`);
    console.log(`Hash: ${update.hash}`);

    try {
        const result = await switchService.confirmDeposit(update.reference, update.hash);
        console.log('✅ Response:', JSON.stringify(result, null, 2));
    } catch (e: any) {
        console.error('❌ Error:', e.message);
        if (e.response) console.error('Data:', JSON.stringify(e.response.data));
    }
})();

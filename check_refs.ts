
import { switchService } from './src/services/switch';

const refs = [
    '1410aa99-4614-4e63-86ca-a8f1bd699892',
    '3d4d9147-0dbb-48c0-a42e-302e5a3af5d6'
];

(async () => {
    for (const ref of refs) {
        try {
            console.log(`Checking status for ${ref}...`);
            const status = await switchService.getStatus(ref);
            console.log(`\n--- Status for ${ref} ---`);
            console.log(JSON.stringify(status, null, 2));
        } catch (e: any) {
            console.error(`Error fetching ${ref}:`, e.message);
        }
    }
})();

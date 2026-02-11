
import { switchService } from './src/services/switch';

const updates = [
    {
        ref: '1410aa99-4614-4e63-86ca-a8f1bd699892',
        hash: '5hUiqRAZPzsrVYVek1CY4iYX1WXSmzgmBURoGoBtHKCaQrEtE1UcThBVhYTHYnoNXC2AqhDrMbQyvbjMDt27uJSL'
    },
    {
        ref: '3d4d9147-0dbb-48c0-a42e-302e5a3af5d6',
        hash: 'kMb76oc1wYbyntah3Nj8vz51KrpRVB9He7yy6eD5YgsNGvGePA93AYbKZkhPgmK8vzG4BkcRuNmiQTvvugkqKih'
    }
];

(async () => {
    for (const update of updates) {
        try {
            console.log(`Confirming ${update.ref} with hash ${update.hash.substr(0, 10)}...`);
            const res = await switchService.confirmDeposit(update.ref, update.hash);
            console.log(`✅ Success:`, res);
        } catch (e: any) {
            console.error(`❌ Failed:`, e.message);
            if (e.response) console.error(JSON.stringify(e.response.data));
        }
    }
})();

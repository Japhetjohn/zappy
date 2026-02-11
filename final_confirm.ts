
import { switchService } from './src/services/switch';

const requests = [
    {
        reference: "1410aa99-4614-4e63-86ca-a8f1bd699892",
        hash: "5hUiqRAZPzsrVYVek1CY4iYX1WXSmzgmBURoGoBtHKCaQrEtE1UcThBVhYTHYnoNXC2AqhDrMbQyvbjMDt27uJSL"
    },
    {
        reference: "3d4d9147-0dbb-48c0-a42e-302e5a3af5d6",
        hash: "kMb76oc1wYbyntah3Nj8vz51KrpRVB9He7yy6eD5YgsNGvGePA93AYbKZkhPgmK8vzG4BkcRuNmiQTvvugkqKih"
    }
];

(async () => {
    for (const req of requests) {
        console.log(`\n🚀 Sending /confirm for ${req.reference} with hash ${req.hash.substring(0, 10)}...`);
        try {
            // switchService.confirmDeposit now accepts (reference, hash) and builds the payload: { reference, hash }
            const result = await switchService.confirmDeposit(req.reference, req.hash);
            console.log('✅ Response:', JSON.stringify(result, null, 2));
        } catch (e: any) {
            console.error('❌ Error:', e.message);
            if (e.response) console.error('Data:', JSON.stringify(e.response.data));
        }
    }
})();

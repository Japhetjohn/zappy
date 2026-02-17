
import { storageService } from '../src/services/storage';
import { config } from '../src/config';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env') }); // Ensure we load the NEW .env with 0.4

async function sync() {
    const desiredFee = process.env.DEVELOPER_FEE || '0.4';
    console.log(`🔄 Syncing Fee to: ${desiredFee}%`);

    storageService.updateSetting('platform_fee', desiredFee);

    // Verify
    const settings = storageService.getSettings();
    console.log(`✅ Current DB Fee: ${settings.platform_fee}%`);
}

sync();

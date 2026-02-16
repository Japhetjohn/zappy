"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const dotenv = __importStar(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv.config({ path: path_1.default.resolve(__dirname, '../.env') });
const PORT = process.env.PORT || 3000;
const HEALTH_URL = `http://localhost:${PORT}/health`;
const INTERVAL = 60000;
console.log(`Starting Bitnova Watcher... Monitoring ${HEALTH_URL}`);
let failureCount = 0;
const checkHealth = async () => {
    try {
        const start = Date.now();
        const response = await axios_1.default.get(HEALTH_URL, { timeout: 5000 });
        const latency = Date.now() - start;
        if (response.status === 200) {
            if (failureCount > 0) {
                console.log(`✅ Bot recovered after ${failureCount} failures! Latency: ${latency}ms`);
                failureCount = 0;
            }
        }
        else {
            throw new Error(`Status ${response.status}`);
        }
    }
    catch (error) {
        failureCount++;
        console.error(`⚠️ Health check failed (${failureCount}/5): ${error.message}`);
        if (failureCount >= 5) {
            console.error('🚨 BOT IS UNARESPONSIVE FOR 5 MINUTES! 🚨');
        }
    }
};
checkHealth();
setInterval(checkHealth, INTERVAL);
//# sourceMappingURL=watcher.js.map
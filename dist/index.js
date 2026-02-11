"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bot_1 = require("./bot");
const server_1 = require("./server");
const logger_1 = __importDefault(require("./utils/logger"));
async function main() {
    try {
        (0, server_1.startServer)();
        await (0, bot_1.startBot)();
    }
    catch (err) {
        logger_1.default.error(`Critical startup failure: ${err.message}`);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=index.js.map
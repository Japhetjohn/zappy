"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bot_1 = require("./bot");
(0, bot_1.startBot)().catch(err => {
    console.error('Failed to start bot:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map
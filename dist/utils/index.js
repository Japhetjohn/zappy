"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginationKeyboard = exports.safeDelete = exports.safeEdit = exports.formatAmount = void 0;
const telegraf_1 = require("telegraf");
const formatAmount = (num) => {
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 4,
        minimumFractionDigits: 0
    }).format(num);
};
exports.formatAmount = formatAmount;
const safeEdit = async (ctx, text, extra) => {
    try {
        if (ctx.callbackQuery) {
            await ctx.editMessageText(text, { parse_mode: 'HTML', ...extra });
        }
        else {
            await ctx.replyWithHTML(text, extra);
        }
    }
    catch (error) {
        if (error.message.includes('message is not modified'))
            return;
        console.error('SafeEdit failed:', error.message);
        await ctx.replyWithMarkdown(text, extra).catch(() => { });
    }
};
exports.safeEdit = safeEdit;
const safeDelete = async (ctx, messageId) => {
    var _a;
    try {
        const id = messageId || ((_a = ctx.message) === null || _a === void 0 ? void 0 : _a.message_id);
        if (id)
            await ctx.deleteMessage(id);
    }
    catch (e) { }
};
exports.safeDelete = safeDelete;
const paginationKeyboard = (items, page, pageSize, callbackPrefix, cancelAction = 'cancel', backAction) => {
    const totalPages = Math.ceil(items.length / pageSize);
    const start = page * pageSize;
    const end = start + pageSize;
    const currentItems = items.slice(start, end);
    const buttons = [];
    for (let i = 0; i < currentItems.length; i += 2) {
        const row = [telegraf_1.Markup.button.callback(currentItems[i].name, `${callbackPrefix}:${currentItems[i].code || currentItems[i].id}`)];
        if (currentItems[i + 1]) {
            row.push(telegraf_1.Markup.button.callback(currentItems[i + 1].name, `${callbackPrefix}:${currentItems[i + 1].code || currentItems[i + 1].id}`));
        }
        buttons.push(row);
    }
    const navRow = [];
    if (page > 0)
        navRow.push(telegraf_1.Markup.button.callback('⬅️ Prev', `page:${page - 1}`));
    if (totalPages > 1)
        navRow.push(telegraf_1.Markup.button.callback(`Page ${page + 1}/${totalPages}`, 'noop'));
    if (page < totalPages - 1)
        navRow.push(telegraf_1.Markup.button.callback('Next ➡️', `page:${page + 1}`));
    if (navRow.length > 0)
        buttons.push(navRow);
    const controls = [];
    if (backAction)
        controls.push(telegraf_1.Markup.button.callback('⬅️ Back', backAction));
    controls.push(telegraf_1.Markup.button.callback('❌ Cancel', cancelAction));
    buttons.push(controls);
    return telegraf_1.Markup.inlineKeyboard(buttons);
};
exports.paginationKeyboard = paginationKeyboard;
//# sourceMappingURL=index.js.map
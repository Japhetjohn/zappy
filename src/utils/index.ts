import { Markup } from 'telegraf';

/**
 * Shared utility functions for Zappy Bot
 */

/**
 * Formats a number with comma separators and up to 2 decimal places
 * @param num The number to format
 * @returns Formatted string
 */
export const formatAmount = (num: number): string => {
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 4,
        minimumFractionDigits: 0
    }).format(num);
};

/**
 * Helper to safely edit a message without crashing if the content is the same
 */
export const safeEdit = async (ctx: any, text: string, extra?: any) => {
    try {
        if (ctx.callbackQuery) {
            await ctx.editMessageText(text, { parse_mode: 'HTML', ...extra });
        } else {
            // If it's a new message, we reply
            await ctx.replyWithHTML(text, extra);
        }
    } catch (error: any) {
        if (error.message.includes('message is not modified')) return;
        console.error('SafeEdit failed:', error.message);
        await ctx.replyWithMarkdown(text, extra).catch(() => { });
    }
};

/**
 * Helper to delete a message safely
 */
export const safeDelete = async (ctx: any, messageId?: number) => {
    try {
        const id = messageId || ctx.message?.message_id;
        if (id) await ctx.deleteMessage(id);
    } catch (e) { }
};

/**
 * Generates a pagination-capable inline keyboard
 */
export const paginationKeyboard = (
    items: any[],
    page: number,
    pageSize: number,
    callbackPrefix: string,
    cancelAction: string = 'cancel',
    backAction?: string
) => {
    const totalPages = Math.ceil(items.length / pageSize);
    const start = page * pageSize;
    const end = start + pageSize;
    const currentItems = items.slice(start, end);

    const buttons = [];

    // Rows of 2
    for (let i = 0; i < currentItems.length; i += 2) {
        const row = [Markup.button.callback(currentItems[i].name, `${callbackPrefix}:${currentItems[i].code || currentItems[i].id}`)];
        if (currentItems[i + 1]) {
            row.push(Markup.button.callback(currentItems[i + 1].name, `${callbackPrefix}:${currentItems[i + 1].code || currentItems[i + 1].id}`));
        }
        buttons.push(row);
    }

    // Pagination row
    const navRow = [];
    if (page > 0) navRow.push(Markup.button.callback('⬅️ Prev', `page:${page - 1}`));
    if (totalPages > 1) navRow.push(Markup.button.callback(`Page ${page + 1}/${totalPages}`, 'noop'));
    if (page < totalPages - 1) navRow.push(Markup.button.callback('Next ➡️', `page:${page + 1}`));

    if (navRow.length > 0) buttons.push(navRow);

    // Controls
    const controls = [];
    if (backAction) controls.push(Markup.button.callback('⬅️ Back', backAction));
    controls.push(Markup.button.callback('❌ Cancel', cancelAction));
    buttons.push(controls);

    return Markup.inlineKeyboard(buttons);
};
export * from './explorer';

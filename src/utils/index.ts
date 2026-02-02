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
        maximumFractionDigits: 2,
        minimumFractionDigits: 0
    }).format(num);
};

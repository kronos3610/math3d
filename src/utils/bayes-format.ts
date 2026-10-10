export const formatBayesCount = (value: number): string => value.toLocaleString('en-US', { maximumFractionDigits: 1 });

export function formatBayesPercent(value: number): string {
    const percentage = 100 * value;
    const decimals = (percentage > 0 && percentage < 1) || (percentage > 99 && percentage < 100) ? 2 : 1;
    return `${percentage.toLocaleString('en-US', { maximumFractionDigits: decimals })}%`;
}

export function isBayesPercentRounded(value: number): boolean {
    return Number(formatBayesPercent(value).slice(0, -1)) / 100 !== value;
}

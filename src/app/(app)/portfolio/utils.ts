export function formatUSD(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function calculateDailyChangeAmount(
  currentPrice: number | null,
  changePercent: number | null,
  quantity: number
) {
  if (currentPrice === null || changePercent === null) {
    return null;
  }

  const ratio = 1 + changePercent / 100;
  if (ratio <= 0) {
    return null;
  }

  const previousClose = currentPrice / ratio;
  return (currentPrice - previousClose) * quantity;
}

interface RatesCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

let cache: RatesCache | null = null;

const FALLBACK_RATES: Record<string, number> = {
  USD: 1, EUR: 0.93, GBP: 0.79, INR: 83.5,
  SGD: 1.35, AED: 3.67, CNY: 7.24,
};

export async function getRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < 3_600_000) return cache.rates;

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (data?.rates) {
      cache = { rates: data.rates, fetchedAt: now };
      return data.rates;
    }
  } catch {
  }

  return cache?.rates ?? FALLBACK_RATES;
}

export function toUSD(amount: number, currency: string, rates: Record<string, number>): number {
  if (currency === "USD") return amount;
  const rate = rates[currency];
  if (!rate || rate === 0) return amount;
  return amount / rate;
}

import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEnvelope<T> {
  value: T;
  expiresAt: number;
  savedAt: number;
}

const memoryCache = new Map<string, CacheEnvelope<unknown>>();
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function sourceCacheKey(
  language: { code?: string; symbol?: string },
  type: string,
  id: string,
): string {
  const code = language.code || 'E';
  const symbol = language.symbol || 'en';
  return `source:${code}:${symbol}:${type}:${encodeURIComponent(id).slice(0, 220)}`;
}

export async function getSourceCache<T>(key: string): Promise<T | null> {
  const inMemory = memoryCache.get(key) as CacheEnvelope<T> | undefined;
  if (inMemory && inMemory.expiresAt > Date.now()) return inMemory.value;

  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (parsed.expiresAt <= Date.now()) {
      await AsyncStorage.removeItem(key);
      memoryCache.delete(key);
      return null;
    }
    memoryCache.set(key, parsed);
    return parsed.value;
  } catch {
    return null;
  }
}

export async function setSourceCache<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): Promise<void> {
  const envelope: CacheEnvelope<T> = {
    value,
    savedAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
  };
  memoryCache.set(key, envelope);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Source cache is best-effort; the app must keep working without it.
  }
}

export async function rememberSourceCache<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const cached = await getSourceCache<T>(key);
  if (cached !== null) return cached;
  const value = await loader();
  await setSourceCache(key, value, ttlMs);
  return value;
}

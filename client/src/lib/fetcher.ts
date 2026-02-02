export class FetchError extends Error {
  info: any;
  status: number;
  constructor(message: string, info: any, status: number) {
    super(message);
    this.info = info;
    this.status = status;
  }
}

const TIMEOUT_MS = 10000;

export const fetcher = async (url: string) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorInfo = await res.json().catch(() => ({}));
      throw new FetchError(
        errorInfo.message || `APIリクエストでエラーが発生しました（ステータス: ${res.status}）`,
        errorInfo,
        res.status
      );
    }

    return res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof FetchError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new FetchError(
        'リクエストがタイムアウトしました',
        { message: 'Request timeout' },
        0
      );
    }

    throw new FetchError(
      'ネットワークエラーが発生しました',
      { message: error instanceof Error ? error.message : 'Unknown error' },
      0
    );
  }
};

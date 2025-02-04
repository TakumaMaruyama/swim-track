export class FetchError extends Error {
  info: any;
  status: number;
  constructor(message: string, info: any, status: number) {
    super(message);
    this.info = info;
    this.status = status;
  }
}

export const fetcher = async (url: string) => {
  const maxRetries = 3;
  const retryDelay = 1000;

  const fetchWithRetry = async (attempt: number): Promise<any> => {
    try {
      const res = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const error = new FetchError(
          `APIリクエストでエラーが発生しました（ステータス: ${res.status}）`,
          await res.json().catch(() => ({})),
          res.status
        );
        throw error;
      }

      return res.json();
    } catch (error) {
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        return fetchWithRetry(attempt + 1);
      }

      if (error instanceof FetchError) {
        throw error;
      }

      throw new FetchError(
        'ネットワークエラーが発生しました',
        { message: error instanceof Error ? error.message : 'Unknown error' },
        0
      );
    }
  };

  return fetchWithRetry(1);
};
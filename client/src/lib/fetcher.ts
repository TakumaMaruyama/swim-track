export class FetchError extends Error {
  info: any;
  status: number;
  constructor(message: string, info: any, status: number) {
    super(message);
    this.info = info;
    this.status = status;
  }
}

// SWR用のfetcher関数：クレデンシャルとエラーハンドリングを含む
export const fetcher = async (url: string) => {
  const res = await fetch(url, {
    credentials: 'include',
  });

  if (!res.ok) {
    const error = new FetchError(
      `APIリクエストでエラーが発生しました（ステータス: ${res.status}）`,
      await res.json(),
      res.status
    );
    throw error;
  }

  return res.json();
};

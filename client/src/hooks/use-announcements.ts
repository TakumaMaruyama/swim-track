import useSWR from "swr";
import { useCallback, useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "./use-auth";
import { fetcher } from "@/lib/fetcher";

export interface Announcement {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  createdBy: number;
}

export function useAnnouncements() {
  const { data, error, mutate } = useSWR<Announcement>("/api/announcements/latest", fetcher);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  // データが変わったときにステートを更新
  useEffect(() => {
    if (data) {
      console.log("Setting announcement from data:", data);
      setAnnouncement(data);
    }
  }, [data]);

  // 手動でデータを取得する関数
  const fetchLatestAnnouncement = useCallback(async () => {
    try {
      const response = await fetch("/api/announcements/latest");
      
      if (!response.ok) {
        throw new Error("お知らせの取得に失敗しました");
      }
      
      const data = await response.json();
      console.log("Manually fetched announcement:", data);
      setAnnouncement(data);
      mutate(data, false); // SWRキャッシュも更新
      return data;
    } catch (error) {
      console.error("Error fetching announcement:", error);
    }
  }, [mutate]);

  // コンポーネントがマウントされたときに一度だけ実行
  useEffect(() => {
    if (!data && !error) {
      fetchLatestAnnouncement();
    }
  }, [fetchLatestAnnouncement, data, error]);

  const updateAnnouncement = useCallback(async (content: string) => {
    if (!isAdmin) {
      toast({
        title: "権限エラー",
        description: "管理者権限が必要です",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "お知らせの更新に失敗しました");
      }

      const updatedAnnouncement = await response.json();
      console.log("Updated announcement:", updatedAnnouncement);
      
      // SWRのキャッシュを更新
      mutate(updatedAnnouncement, false);
      
      // ローカルのステートも更新
      setAnnouncement(updatedAnnouncement);
      
      toast({
        title: "成功",
        description: "お知らせが更新されました",
      });

      // 更新後、最新データを改めて取得
      setTimeout(() => {
        fetchLatestAnnouncement();
      }, 500);

      return updatedAnnouncement;
    } catch (error) {
      console.error("Failed to update announcement:", error);
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "お知らせの更新に失敗しました",
        variant: "destructive",
      });
    }
  }, [isAdmin, toast, mutate, fetchLatestAnnouncement]);

  return {
    announcement: announcement,
    isLoading: !error && !data && !announcement,
    error,
    updateAnnouncement,
    fetchLatestAnnouncement,
  };
}
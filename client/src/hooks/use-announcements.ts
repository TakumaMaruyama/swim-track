import useSWR from "swr";
import { useCallback } from "react";
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
  const { data, error, mutate, isLoading } = useSWR<Announcement>(
    "/api/announcements/latest",
    fetcher
  );
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  // 手動でデータを取得する関数
  const fetchLatestAnnouncement = useCallback(async () => {
    try {
      const latest = await fetcher("/api/announcements/latest");
      mutate(latest, false); // SWRキャッシュを即時更新
      return latest;
    } catch (error) {
      console.error("Error fetching announcement:", error);
      return null;
    }
  }, [mutate]);

  const updateAnnouncement = useCallback(async (content: string) => {
    if (!isAdmin) {
      toast({
        title: "権限エラー",
        description: "管理者権限が必要です",
        variant: "destructive",
      });
      return null;
    }

    try {
      console.log("Sending announcement update request with content:", content);
      
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
        credentials: "include",
      });

      console.log("Announcement update response status:", response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Server returned error:", errorData);
        throw new Error(errorData.message || "お知らせの更新に失敗しました");
      }

      const updatedAnnouncement = await response.json();
      console.log("Updated announcement:", updatedAnnouncement);
      
      // SWRのキャッシュを更新（再検証なし）
      mutate(updatedAnnouncement, false);
      
      toast({
        title: "成功",
        description: "お知らせが更新されました",
      });

      return updatedAnnouncement;
    } catch (error) {
      console.error("Failed to update announcement:", error);
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "お知らせの更新に失敗しました",
        variant: "destructive",
      });
    }
  }, [isAdmin, toast, mutate]);

  return {
    announcement: data || null,
    isLoading: isLoading && !data,
    error,
    updateAnnouncement,
    fetchLatestAnnouncement,
  };
}

import useSWR from "swr";
import { useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "./use-auth";

export interface Announcement {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  createdBy: number;
}

export function useAnnouncements() {
  const { data, error, mutate } = useSWR<Announcement>("/api/announcements/latest");
  const { toast } = useToast();
  const { isAdmin } = useAuth();

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
      mutate(updatedAnnouncement);
      
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
    announcement: data,
    isLoading: !error && !data,
    error,
    updateAnnouncement,
  };
}
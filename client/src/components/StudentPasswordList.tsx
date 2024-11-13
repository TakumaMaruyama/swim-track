import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import useSWR from "swr";
import type { User } from "db/schema";

interface StudentPasswordListProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StudentPasswordList({ isOpen, onClose }: StudentPasswordListProps) {
  const { toast } = useToast();
  const { data: students, error } = useSWR<User[]>("/api/users/passwords");

  if (error) {
    toast({
      variant: "destructive",
      title: "エラー",
      description: "学生情報の取得に失敗しました",
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>学生一覧とパスワード</DialogTitle>
          <DialogDescription>
            学生のアカウント情報一覧です
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4 overflow-y-auto max-h-[60vh] pr-2">
          {students?.map((student) => (
            <Card key={student.id}>
              <CardContent className="flex justify-between items-center p-4">
                <span className="font-medium">{student.username}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

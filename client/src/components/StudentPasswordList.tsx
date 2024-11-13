import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>学生一覧とパスワード</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {students?.map((student) => (
            <Card key={student.id}>
              <CardContent className="flex justify-between items-center p-4">
                <span className="font-medium">{student.username}</span>
                <span className="text-sm text-muted-foreground">{student.password}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import useSWR from "swr";
import type { User } from "db/schema";

interface UserPasswordListProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserPasswordList({ isOpen, onClose }: UserPasswordListProps) {
  const { toast } = useToast();
  const { data: students, error } = useSWR<User[]>("/api/users/passwords");

  React.useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "学生情報の取得に失敗しました",
      });
    }
  }, [error, toast]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>学生一覧</DialogTitle>
          <DialogDescription>
            学生のアカウント情報一覧です
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4 overflow-y-auto max-h-[60vh] pr-2">
          {students?.map((student) => (
            <Card key={student.id}>
              <CardContent className="flex justify-between items-center p-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{student.username}</span>
                  <Badge variant={student.isActive ? 'default' : 'secondary'}>
                    {student.isActive ? '有効' : '無効'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
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

interface StudentPasswordListProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StudentPasswordList({ isOpen, onClose }: StudentPasswordListProps) {
  const { toast } = useToast();
  const { data: users, error } = useSWR<User[]>("/api/users/passwords");

  // Use useEffect for error handling
  React.useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "ユーザー情報の取得に失敗しました",
      });
    }
  }, [error, toast]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>ユーザー一覧とパスワード</DialogTitle>
          <DialogDescription>
            ユーザーアカウント情報一覧です
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4 overflow-y-auto max-h-[60vh] pr-2">
          {users?.map((user) => (
            <Card key={user.id}>
              <CardContent className="flex justify-between items-center p-4">
                <div>
                  <span className="font-medium">{user.username}</span>
                  <Badge variant={user.role === 'coach' ? "default" : "secondary"} className="ml-2">
                    {user.role === 'coach' ? 'コーチ' : '選手'}
                  </Badge>
                </div>
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {user.password}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

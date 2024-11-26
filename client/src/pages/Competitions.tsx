import React from 'react';
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trophy, Plus, Edit2, Trash2 } from "lucide-react";
import useSWR from 'swr';
import { CompetitionForm } from '@/components/CompetitionForm';
import { competitionSchema } from '@/lib/schema';
import * as z from 'zod';
import { useUser } from '../hooks/use-user';

type Competition = {
  id: number;
  name: string;
  location: string;
  date: string;
  recordCount?: number;
};

export default function CompetitionsPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const [isAddingCompetition, setIsAddingCompetition] = React.useState(false);
  const [editingCompetition, setEditingCompetition] = React.useState<Competition | null>(null);
  const [deletingCompetition, setDeletingCompetition] = React.useState<Competition | null>(null);
  
  const { data: competitions, mutate } = useSWR<Competition[]>('/api/competitions', {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const handleCompetitionSubmit = async (values: z.infer<typeof competitionSchema>, id?: number) => {
    try {
      // Optimistically update the UI
      const oldCompetitions = competitions || [];
      const newCompetition = { ...values, id: id || -1 };
      
      if (id) {
        mutate(
          oldCompetitions.map(c => c.id === id ? { ...c, ...newCompetition } : c),
          false
        );
      } else {
        mutate([...oldCompetitions, newCompetition], false);
      }

      // Send request to the server
      const method = id ? 'PUT' : 'POST';
      const url = id ? `/api/competitions/${id}` : '/api/competitions';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to save competition');
      }

      // Revalidate to ensure we have the latest data
      await mutate();
      
      setIsAddingCompetition(false);
      setEditingCompetition(null);
      
      toast({
        title: id ? "更新成功" : "追加成功",
        description: `${values.name}が正常に${id ? '更新' : '追加'}されました`,
      });
    } catch (error) {
      console.error('Error saving competition:', error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "大会情報の保存に失敗しました",
      });
      // Revalidate to restore the original data
      await mutate();
    }
  };

  const handleDelete = async (competition: Competition) => {
    try {
      // Optimistically remove from UI
      const oldCompetitions = competitions || [];
      mutate(
        oldCompetitions.filter(c => c.id !== competition.id),
        false
      );

      const response = await fetch(`/api/competitions/${competition.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete competition');
      }

      // Revalidate to ensure we have the latest data
      await mutate();
      
      toast({
        title: "削除成功",
        description: `${competition.name}が正常に削除されました`,
      });
    } catch (error) {
      console.error('Error deleting competition:', error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "大会情報の削除に失敗しました",
      });
      // Revalidate to restore the original data
      await mutate();
    } finally {
      setDeletingCompetition(null);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <PageHeader title="大会情報">
        {user?.role === 'coach' && (
          <Button onClick={() => setIsAddingCompetition(true)}>
            <Plus className="mr-2 h-4 w-4" />
            大会を追加
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6">
        {competitions?.map((competition) => (
          <Card key={competition.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                {competition.name}
                {user?.role === 'coach' && (
                  <div className="ml-auto flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingCompetition(competition)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingCompetition(competition)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  開催場所: {competition.location}
                </p>
                <p className="text-sm text-muted-foreground">
                  開催日: {new Date(competition.date).toLocaleDateString('ja-JP')}
                </p>
                {competition.recordCount !== undefined && (
                  <p className="text-sm font-medium">
                    記録数: {competition.recordCount}件
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <CompetitionForm
        competition={editingCompetition || undefined}
        isOpen={isAddingCompetition || !!editingCompetition}
        onClose={() => {
          setIsAddingCompetition(false);
          setEditingCompetition(null);
        }}
        onSubmit={handleCompetitionSubmit}
      />

      <AlertDialog 
        open={!!deletingCompetition} 
        onOpenChange={(open) => !open && setDeletingCompetition(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>大会情報を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。大会情報が完全に削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCompetition && handleDelete(deletingCompetition)}
              className="bg-red-500 hover:bg-red-600"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

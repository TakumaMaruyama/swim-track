import React from 'react';
import * as z from 'zod';
import useSWR from 'swr';
import { Pencil, Plus, Trophy } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CompetitionForm } from '@/components/CompetitionForm';
import { competitionSchema } from '@/lib/schema';

type Competition = z.infer<typeof competitionSchema> & {
  id: number;
  recordCount: number;
};

export default function CompetitionsPage() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingCompetition, setEditingCompetition] = React.useState<Competition | null>(null);
  const { data: competitions, mutate } = useSWR<Competition[]>('/api/competitions');

  const handleSaved = async (values: z.infer<typeof competitionSchema>) => {
    await mutate();
    setIsFormOpen(false);
    setEditingCompetition(null);
    toast({
      title: editingCompetition ? "更新成功" : "追加成功",
      description: `${values.name}を保存しました`,
    });
  };

  const openCreateForm = () => {
    setEditingCompetition(null);
    setIsFormOpen(true);
  };

  const openEditForm = (competition: Competition) => {
    setEditingCompetition(competition);
    setIsFormOpen(true);
  };

  return (
    <div className="container mx-auto py-6">
      <PageHeader title="大会情報">
        {isAdmin && (
          <Button onClick={openCreateForm}>
            <Plus className="mr-2 h-4 w-4" />
            大会を追加
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6">
        {competitions?.map((competition) => (
          <Card key={competition.id}>
            <CardHeader>
              <CardTitle className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  <span>{competition.name}</span>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditForm(competition)}
                    className="shrink-0"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
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
                <p className="text-sm font-medium">
                  記録数: {competition.recordCount}件
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <CompetitionForm
        isOpen={isFormOpen}
        competition={editingCompetition}
        onClose={() => {
          setIsFormOpen(false);
          setEditingCompetition(null);
        }}
        onSubmit={handleSaved}
      />
    </div>
  );
}

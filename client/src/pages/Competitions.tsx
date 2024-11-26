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
import { Trophy, Plus } from "lucide-react";
import useSWR from 'swr';
import { CompetitionForm } from '@/components/CompetitionForm';

type Competition = {
  name: string;
  location: string;
  date: string;
  recordCount: number;
};

export default function CompetitionsPage() {
  const { toast } = useToast();
  const [isAddingCompetition, setIsAddingCompetition] = React.useState(false);
  const { data: competitions, mutate } = useSWR<Competition[]>('/api/competitions');

  const handleCompetitionAdded = async () => {
    await mutate();
    setIsAddingCompetition(false);
    toast({
      title: "大会情報を追加しました",
      description: "大会情報が正常に追加されました",
    });
  };

  return (
    <div className="container mx-auto py-6">
      <PageHeader
        heading="大会情報"
        description="大会情報の管理と記録の閲覧"
        actions={
          <Button onClick={() => setIsAddingCompetition(true)}>
            <Plus className="mr-2 h-4 w-4" />
            大会を追加
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6">
        {competitions?.map((competition) => (
          <Card key={competition.name + competition.date}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                {competition.name}
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
        isOpen={isAddingCompetition}
        onClose={() => setIsAddingCompetition(false)}
        onSubmit={handleCompetitionAdded}
      />
    </div>
  );
}

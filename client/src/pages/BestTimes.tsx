import React from 'react';
import { useSwimRecords } from '@/hooks/use-swim-records';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Edit2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditRecordForm } from '@/components/EditRecordForm';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/PageHeader';

type GroupedRecords = {
  [style: string]: {
    [distance: number]: {
      id: number;
      time: string;
      date: Date;
      studentId: number;
      isCompetition: boolean;
      poolLength: number;
      athleteName?: string;
    };
  };
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
};

const RecordCard = React.memo(({ style, distances }: { 
  style: string; 
  distances: GroupedRecords[string];
}) => {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="text-xl">{style}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(distances).map(([distance, record]) => (
            <div 
              key={distance} 
              className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 rounded-lg bg-muted/50"
            >
              <div className="mb-2 sm:mb-0">
                <p className="font-medium text-lg">
                  {distance}m ({record.poolLength}mプール)
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(record.date)} - {record.athleteName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold text-primary">{record.time}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

RecordCard.displayName = "RecordCard";

export default function BestTimes() {
  const { toast } = useToast();
  const { records, isLoading, error, mutate } = useSwimRecords();
  
  const [editingRecord, setEditingRecord] = React.useState<number | null>(null);

  const groupedRecords: GroupedRecords = React.useMemo(() => {
    if (!records) return {};

    return records.reduce((acc, record) => {
      if (!acc[record.style]) {
        acc[record.style] = {};
      }
      
      const currentBest = acc[record.style][record.distance];
      if (!currentBest || record.time < currentBest.time) {
        acc[record.style][record.distance] = {
          id: record.id,
          time: record.time,
          date: new Date(record.date || Date.now()),
          studentId: record.studentId,
          isCompetition: record.isCompetition ?? false,
          poolLength: record.poolLength,
          athleteName: record.athleteName || '',
        };
      }
      
      return acc;
    }, {} as GroupedRecords);
  }, [records]);

  const handleEdit = React.useCallback(async (recordId: number, data: any) => {
    try {
      const response = await fetch(`/api/records/${recordId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to update record');
      }

      await mutate();
      toast({
        title: "更新成功",
        description: "記録が更新されました",
      });
    } catch (error) {
      console.error('Error updating record:', error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "記録の更新に失敗しました",
      });
      throw error;
    }
  }, [mutate, toast]);

  if (isLoading) {
    return (
      <>
        <PageHeader title="ベストタイム" />
        <div className="container">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-pulse text-lg">記録を読み込んでいます...</div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    console.error('Error fetching records:', error);
    return (
      <>
        <PageHeader title="ベストタイム" />
        <div className="container">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              記録の取得中にエラーが発生しました。再度お試しください。
              {error instanceof Error && (
                <p className="mt-2 text-sm opacity-75">
                  エラー詳細: {error.message}
                </p>
              )}
            </AlertDescription>
          </Alert>
          <Button
            onClick={() => mutate()}
            className="mt-4"
            variant="outline"
          >
            再読み込み
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader 
        title="ベストタイム"
        children={
          <Button
            onClick={() => {
              toast({
                title: "情報",
                description: "新規記録の追加は管理者のみが可能です",
              });
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            新規記録追加
          </Button>
        }
      />
      <div className="container px-4 md:px-8">
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(groupedRecords).map(([style, distances]) => (
            <RecordCard key={style} style={style} distances={distances} />
          ))}
        </div>
      </div>

      <EditRecordForm
        record={editingRecord === -1 ? undefined : records?.find(r => r.id === editingRecord)}
        isOpen={!!editingRecord}
        onClose={() => setEditingRecord(null)}
        onSubmit={async (data) => {
          if (editingRecord !== -1) {
            await handleEdit(editingRecord, data);
          }
          setEditingRecord(null);
        }}
      />
    </>
  );
}
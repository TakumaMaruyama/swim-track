import React from 'react';
import { useSwimRecords } from '../hooks/use-swim-records';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Edit2, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditRecordForm } from '../components/EditRecordForm';
import { useUser } from '../hooks/use-user';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '../components/PageHeader';

type GroupedCompetitions = {
  [date: string]: {
    id: number;
    style: string;
    distance: number;
    poolLength?: number;
    time: string;
    studentId: number;
    isCompetition: boolean;
    athleteName?: string;
  }[];
};

const formatDate = (date: Date | null) => {
  if (!date) return '';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
};

export default function Competitions() {
  const { user } = useUser();
  const { toast } = useToast();
  const { records, isLoading, error, mutate } = useSwimRecords(true);
  const [editingRecord, setEditingRecord] = React.useState<number | null>(null);

  const groupedRecords: GroupedCompetitions = React.useMemo(() => {
    if (!records) return {};

    return records.reduce((acc, record) => {
      const date = formatDate(record.date ? new Date(record.date) : null);
      if (!date) return acc;
      
      if (!acc[date]) {
        acc[date] = [];
      }
      
      acc[date].push({
        id: record.id,
        style: record.style,
        distance: record.distance,
        poolLength: record.poolLength,
        time: record.time,
        studentId: record.studentId,
        isCompetition: record.isCompetition ?? false,
        athleteName: record.athleteName,
      });
      
      return acc;
    }, {} as GroupedCompetitions);
  }, [records]);

  const handleEdit = async (recordId: number, data: any) => {
    try {
      const response = await fetch(`/api/records/${recordId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...data, isCompetition: true }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to update record');
      }

      await mutate();
      toast({
        title: "更新成功",
        description: "大会記録が更新されました",
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
  };

  const handleCreate = async (data: any) => {
    try {
      const response = await fetch('/api/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...data, isCompetition: true }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to create record');
      }

      await mutate();
      toast({
        title: "追加成功",
        description: "新しい大会記録が追加されました",
      });
    } catch (error) {
      console.error('Error creating record:', error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "記録の追加に失敗しました",
      });
      throw error;
    }
  };

  const handleDelete = async (recordId: number) => {
    if (!confirm('この記録を削除してもよろしいですか？')) {
      return;
    }

    try {
      const response = await fetch(`/api/records/${recordId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete record');
      }

      await mutate();
      toast({
        title: "削除成功",
        description: "記録が削除されました",
      });
    } catch (error) {
      console.error('Error deleting record:', error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "記録の削除に失敗しました",
      });
    }
  };

  const record = records?.find(r => r.id === editingRecord);

  if (isLoading) {
    return (
      <>
        <PageHeader title="大会記録" />
        <div className="container">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-pulse text-lg">大会記録を読み込んでいます...</div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="大会記録" />
        <div className="container">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              大会記録の取得中にエラーが発生しました。再度お試しください。
            </AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader 
        title="大会記録"
        children={
          user?.role === 'coach' && (
            <Button onClick={() => setEditingRecord(-1)}>
              <Plus className="mr-2 h-4 w-4" />
              新規記録追加
            </Button>
          )
        }
      />
      
      <div className="container px-4 md:px-8">
        <div className="space-y-6">
          {Object.entries(groupedRecords)
            .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
            .map(([date, records]) => (
              <Card key={date} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-xl">{date}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {records.map((record) => (
                      <div 
                        key={record.id} 
                        className="flex flex-col p-4 rounded-lg bg-muted/50"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="space-y-1">
                            <p className="font-medium text-lg">{record.style}</p>
                            <p className="font-medium">
                              {record.distance}m {record.poolLength ? `(${record.poolLength}mプール)` : ''}
                            </p>
                          </div>
                          {user?.role === 'coach' && (
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingRecord(record.id)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(record.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="text-xl font-semibold">{record.athleteName}</p>
                          <p className="text-2xl font-bold text-primary">{record.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>

      <EditRecordForm
        record={editingRecord === -1 ? undefined : record}
        isOpen={!!editingRecord}
        onClose={() => setEditingRecord(null)}
        onSubmit={async (data) => {
          if (editingRecord === -1) {
            await handleCreate(data);
          } else if (record) {
            await handleEdit(record.id, data);
          }
        }}
      />
    </>
  );
}

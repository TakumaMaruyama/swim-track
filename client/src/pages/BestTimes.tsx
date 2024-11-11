import React from 'react';
import { useSwimRecords } from '../hooks/use-swim-records';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditRecordForm } from '../components/EditRecordForm';
import { useUser } from '../hooks/use-user';
import { useToast } from '@/hooks/use-toast';

type GroupedRecords = {
  [style: string]: {
    [distance: number]: {
      id: number;
      time: string;
      date: Date;
      studentId: number;
      isCompetition: boolean;
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

export default function BestTimes() {
  const { user } = useUser();
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
          date: new Date(record.date),
          studentId: record.studentId,
          isCompetition: record.isCompetition,
        };
      }
      
      return acc;
    }, {} as GroupedRecords);
  }, [records]);

  const handleEdit = async (recordId: number, data: any) => {
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
      <div className="container py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse text-lg">記録を読み込んでいます...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            記録の取得中にエラーが発生しました。再度お試しください。
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container py-8 px-4 md:px-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-8">ベストタイム</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(groupedRecords).map(([style, distances]) => (
          <Card key={style} className="hover:shadow-lg transition-shadow">
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
                      <p className="font-medium text-lg">{distance}m</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(record.date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-bold text-primary">{record.time}</p>
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
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {record && (
        <EditRecordForm
          record={record}
          isOpen={!!editingRecord}
          onClose={() => setEditingRecord(null)}
          onSubmit={async (data) => {
            await handleEdit(record.id, data);
          }}
        />
      )}
    </div>
  );
}

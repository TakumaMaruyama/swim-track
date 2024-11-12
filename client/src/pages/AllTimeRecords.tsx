import React from 'react';
import { useSwimRecords } from '../hooks/use-swim-records';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditRecordForm } from '../components/EditRecordForm';
import { useUser } from '../hooks/use-user';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '../components/PageHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type GroupedRecord = {
  id: number;
  style: string;
  distance: number;
  time: string;
  date: Date;
  studentId: number;
  isCompetition: boolean;
  poolLength: number;
  athleteName: string;
};

type GroupedRecords = {
  [key: string]: GroupedRecord;
};

export default function AllTimeRecords() {
  const { user } = useUser();
  const { toast } = useToast();
  const { records, isLoading, error, mutate } = useSwimRecords();
  const [editingRecord, setEditingRecord] = React.useState<number | null>(null);
  const [styleFilter, setStyleFilter] = React.useState<string>("");
  const [poolLengthFilter, setPoolLengthFilter] = React.useState<string>("");

  const swimStyles = [
    "自由形",
    "背泳ぎ",
    "平泳ぎ",
    "バタフライ",
    "個人メドレー"
  ];

  const poolLengths = [15, 25, 50];

  const groupedRecords: GroupedRecords = React.useMemo(() => {
    if (!records) return {};
    return records.reduce((acc, record) => {
      // Apply filters
      if (styleFilter && record.style !== styleFilter) return acc;
      if (poolLengthFilter && record.poolLength !== parseInt(poolLengthFilter)) return acc;

      const key = `${record.style}-${record.distance}-${record.poolLength}`;
      if (!acc[key] || record.time < acc[key].time) {
        acc[key] = {
          ...record,
          date: new Date(record.date)
        };
      }
      return acc;
    }, {} as GroupedRecords);
  }, [records, styleFilter, poolLengthFilter]);

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
      <>
        <PageHeader title="歴代ベスト" />
        <div className="container">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-pulse text-lg">記録を読み込んでいます...</div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="歴代ベスト" />
        <div className="container">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              記録の取得中にエラーが発生しました。再度お試しください。
            </AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="歴代ベスト">
        <div className="flex gap-4">
          <Select value={styleFilter} onValueChange={setStyleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="種目で絞り込み" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">すべての種目</SelectItem>
              {swimStyles.map(style => (
                <SelectItem key={style} value={style}>{style}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={poolLengthFilter} onValueChange={setPoolLengthFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="プール長で絞り込み" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">すべてのプール</SelectItem>
              {poolLengths.map(length => (
                <SelectItem key={length} value={length.toString()}>{length}mプール</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PageHeader>

      <div className="container px-4 md:px-8">
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(groupedRecords).map(([key, record]) => (
            <Card key={key} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div>
                    <span className="text-xl">{record.style}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {record.distance}m ({record.poolLength}mプール)
                    </span>
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
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-3xl font-bold text-primary">{record.time}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {record.athleteName} - {new Date(record.date).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  {record.isCompetition && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      大会記録
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <EditRecordForm
          record={record}
          isOpen={!!editingRecord}
          onClose={() => setEditingRecord(null)}
          onSubmit={async (data) => {
            if (record) {
              await handleEdit(record.id, data);
            }
          }}
        />
      </div>
    </>
  );
}

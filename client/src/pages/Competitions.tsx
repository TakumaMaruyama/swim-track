import React from 'react';
import { useSwimRecords } from '../hooks/use-swim-records';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Edit2, Trash2, Plus, Filter } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

interface CompetitionRecord {
  id: number;
  style: string;
  distance: number;
  poolLength?: number;
  time: string;
  studentId: number;
  isCompetition: boolean;
  athleteName?: string;
  date: Date | null;
}

interface GroupedRecordsByStyle {
  [style: string]: CompetitionRecord[];
}

type GroupedCompetitions = {
  [date: string]: {
    poolLength: number;
    records: GroupedRecordsByStyle;
  };
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
  const [styleFilter, setStyleFilter] = React.useState<string>("all");
  const [poolLengthFilter, setPoolLengthFilter] = React.useState<string>("all");

  const swimStyles = [
    "自由形",
    "背泳ぎ",
    "平泳ぎ",
    "バタフライ",
    "個人メドレー"
  ];

  const poolLengths = [15, 25, 50];

  const groupedRecords: GroupedCompetitions = React.useMemo(() => {
    if (!records) return {};

    const filtered = records.filter(record => {
      const styleMatch = styleFilter === "all" || record.style === styleFilter;
      const poolMatch = poolLengthFilter === "all" || record.poolLength === Number(poolLengthFilter);
      return styleMatch && poolMatch;
    });

    return filtered.reduce((acc, record) => {
      const date = formatDate(record.date ? new Date(record.date) : null);
      if (!date) return acc;
      
      if (!acc[date]) {
        acc[date] = {
          poolLength: record.poolLength || 25,
          records: {},
        };
      }

      const competitionRecord: CompetitionRecord = {
        id: record.id,
        style: record.style,
        distance: record.distance,
        poolLength: record.poolLength,
        time: record.time,
        studentId: record.studentId,
        isCompetition: record.isCompetition ?? false,
        athleteName: record.athleteName,
        date: record.date ? new Date(record.date) : null,
      };
      
      if (!acc[date].records[record.style]) {
        acc[date].records[record.style] = [];
      }
      
      acc[date].records[record.style].push(competitionRecord);
      
      return acc;
    }, {} as GroupedCompetitions);
  }, [records, styleFilter, poolLengthFilter]);

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

  const [deletingRecord, setDeletingRecord] = React.useState<number | null>(null);

  const handleDelete = async (recordId: number) => {
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
    } finally {
      setDeletingRecord(null);
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
          <div className="flex gap-4 items-center">
            <div className="flex gap-2">
              <Select value={styleFilter} onValueChange={setStyleFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="種目で絞り込み" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべての種目</SelectItem>
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
                  <SelectItem value="all">すべてのプール</SelectItem>
                  {poolLengths.map(length => (
                    <SelectItem key={length} value={length.toString()}>{length}mプール</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {user?.role === 'coach' && (
              <Button onClick={() => setEditingRecord(-1)}>
                <Plus className="mr-2 h-4 w-4" />
                新規記録追加
              </Button>
            )}
          </div>
        }
      />
      
      <div className="container px-4 md:px-8">
        <div className="space-y-6">
          {Object.entries(groupedRecords)
            .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
            .map(([date, { poolLength, records }]) => (
              <Card key={date} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex flex-col space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl">大会記録</CardTitle>
                        <Badge variant="outline">{poolLength}mプール</Badge>
                      </div>
                      {user?.role === 'coach' && (
                        <Button onClick={() => setEditingRecord(-1)}>
                          <Plus className="mr-2 h-4 w-4" />
                          記録追加
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{date}</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {Object.entries(records).map(([style, styleRecords]) => (
                      <div key={style} className="space-y-2">
                        <h3 className="text-lg font-semibold">{style}</h3>
                        <div className="bg-muted/50 rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b">
                                <th className="px-4 py-2 text-left">距離</th>
                                <th className="px-4 py-2 text-left">選手名</th>
                                <th className="px-4 py-2 text-left">タイム</th>
                                {user?.role === 'coach' && (
                                  <th className="px-4 py-2 text-right">操作</th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {styleRecords.map((record) => (
                                <tr key={record.id} className="border-b last:border-0">
                                  <td className="px-4 py-2">{record.distance}m</td>
                                  <td className="px-4 py-2">{record.athleteName}</td>
                                  <td className="px-4 py-2 font-semibold text-primary">
                                    {record.time}
                                  </td>
                                  {user?.role === 'coach' && (
                                    <td className="px-4 py-2">
                                      <div className="flex gap-2 justify-end">
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
                                          onClick={() => setDeletingRecord(record.id)}
                                        >
                                          <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
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

      <AlertDialog 
        open={!!deletingRecord} 
        onOpenChange={(open) => !open && setDeletingRecord(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>記録を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。本当にこの記録を削除してもよろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingRecord) {
                  handleDelete(deletingRecord);
                }
              }}
              className="bg-red-500 hover:bg-red-600"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

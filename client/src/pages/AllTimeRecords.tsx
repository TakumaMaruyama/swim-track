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

type GroupedRecordsByStyle = {
  [style: string]: GroupedRecord;
};

type GroupedRecords = {
  [distance: number]: GroupedRecordsByStyle;
};

export default function AllTimeRecords() {
  const { user } = useUser();
  const { toast } = useToast();
  const { records, isLoading, error, mutate } = useSwimRecords();
  const [editingRecord, setEditingRecord] = React.useState<number | null>(null);
  const [styleFilter, setStyleFilter] = React.useState<string>("all");
  const [poolLengthFilter, setPoolLengthFilter] = React.useState<number>(25); // デフォルトは25mプール

  const swimStyles = [
    "バタフライ",
    "背泳ぎ",
    "平泳ぎ",
    "自由形",
    "個人メドレー"
  ];

  const poolLengths = [15, 25, 50];
  
  const formatTime = (time: string) => {
    // MM:SS.ms形式の時間を整形
    const [minutes, seconds] = time.split(':');
    if (!seconds) return time; // 既に整形済みの場合
    return `${minutes}'${seconds}"`; // 日本式の表記に変換
  };

  const groupedRecords: GroupedRecords = React.useMemo(() => {
    if (!records) return {};
    
    // First, filter records
    const filteredRecords = records.filter(record => {
      if (styleFilter !== "all" && record.style !== styleFilter) return false;
      if (record.poolLength !== poolLengthFilter) return false;
      return true;
    });

    // Group by distance first
    const groupedByDistance = filteredRecords.reduce((acc, record) => {
      if (!acc[record.distance]) {
        acc[record.distance] = {};
      }
      
      // Then by style within each distance
      if (!acc[record.distance][record.style] || record.time < acc[record.distance][record.style].time) {
        acc[record.distance][record.style] = {
          id: record.id,
          style: record.style,
          distance: record.distance,
          time: record.time,
          date: new Date(record.date || Date.now()),
          studentId: record.studentId,
          isCompetition: record.isCompetition ?? false,
          poolLength: record.poolLength,
          athleteName: record.athleteName || ''
        };
      }
      return acc;
    }, {} as GroupedRecords);

    // Sort distances
    const sortedGrouped: GroupedRecords = {};
    Object.keys(groupedByDistance)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach(distance => {
        sortedGrouped[distance] = groupedByDistance[distance];
      });

    return sortedGrouped;
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
        <PageHeader title="歴代記録" />
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
        <PageHeader title="歴代記録" />
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
      <PageHeader title="歴代記録">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-4">
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
          </div>
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
            {poolLengths.map(length => (
              <Button
                key={length}
                variant={poolLengthFilter === length ? "default" : "ghost"}
                size="sm"
                onClick={() => setPoolLengthFilter(length)}
                className="min-w-[80px]"
              >
                {length}m
              </Button>
            ))}
          </div>
        </div>
      </PageHeader>

      <div className="container px-4 md:px-8">
        <div className="space-y-8">
          {Object.entries(groupedRecords).map(([distance, styles]) => (
            <div key={distance} className="space-y-4">
              <h2 className="text-3xl font-bold text-primary/90 border-b pb-3 mb-6">
                {distance}m 歴代ベスト
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(styles)
                  .sort(([styleA], [styleB]) => {
                    const indexA = swimStyles.indexOf(styleA);
                    const indexB = swimStyles.indexOf(styleB);
                    return indexA - indexB;
                  })
                  .map(([style, record]) => (
                  <Card key={`${distance}-${style}`} className="hover:shadow-lg transition-shadow group">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold">
                            {style}
                          </span>
                          <div className="h-1 w-1 rounded-full bg-muted-foreground/30"></div>
                          <span className="text-muted-foreground font-medium">
                            {poolLengthFilter}mプール
                          </span>
                        </div>
                        {user?.role === 'coach' && (
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingRecord(record.id)}
                              className="h-8 w-8"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(record.id)}
                              className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-6">
                      <div className="space-y-4">
                        <div className="flex flex-col gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-3xl font-bold text-primary tracking-tight">
                                {formatTime(record.time)}
                              </span>
                              <div className="flex flex-col items-start">
                                <span className="bg-primary/10 text-primary text-sm font-semibold px-2 py-0.5 rounded">
                                  {record.poolLength}mプール
                                </span>
                                {record.isCompetition && (
                                  <span className="bg-secondary/10 text-secondary text-sm font-semibold px-2 py-0.5 rounded mt-1">
                                    大会記録
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between border-t pt-3">
                              <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">記録保持者</p>
                                <p className="text-base font-semibold">
                                  {record.athleteName}
                                </p>
                              </div>
                              <time className="text-sm text-muted-foreground">
                                {new Date(record.date).toLocaleDateString('ja-JP', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </time>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>

        <EditRecordForm
          record={editingRecord === -1 ? undefined : record}
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
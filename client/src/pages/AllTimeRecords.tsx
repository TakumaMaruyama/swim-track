import React from 'react';
import { useSwimRecords } from '../hooks/use-swim-records';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Edit2, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditRecordForm } from '../components/EditRecordForm';
import { useUser } from '../hooks/use-user';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '../components/PageHeader';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

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
  const [styleFilter, setStyleFilter] = React.useState<string>("all");
  const [poolLengthFilter, setPoolLengthFilter] = React.useState<number>(25); // デフォルトは25mプール

  const swimStyles = [
    "自由形",
    "背泳ぎ",
    "平泳ぎ",
    "バタフライ",
    "個人メドレー"
  ];

  const poolLengths = [15, 25, 50];
  
  const formatTime = (time: string) => {
    // MM:SS.ms形式の時間を整形
    const [minutes, seconds] = time.split(':');
    if (!seconds) return time; // 既に整形済みの場合
    return `${minutes}'${seconds}"`; // 日本式の表記に変換
  };

  const groupedRecordsByStyle: { [style: string]: GroupedRecords } = React.useMemo(() => {
    if (!records) return {};
    
    // First group by style
    return swimStyles.reduce((styleAcc, style) => {
      if (styleFilter !== "all" && styleFilter !== style) return styleAcc;
      
      // Then group by distance within each style
      const styleRecords = records.reduce((acc, record) => {
        if (record.style !== style || record.poolLength !== poolLengthFilter) return acc;

        const key = `${record.style}-${record.distance}`;
        if (!acc[key] || record.time < acc[key].time) {
          acc[key] = {
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

      // Only include styles that have records
      if (Object.keys(styleRecords).length > 0) {
        styleAcc[style] = styleRecords;
      }
      
      return styleAcc;
    }, {} as { [style: string]: GroupedRecords });
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
        <div className="w-full max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 flex flex-col sm:flex-row gap-4">
              <Select value={styleFilter} onValueChange={setStyleFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="種目で絞り込み" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべての種目</SelectItem>
                  {swimStyles.map(style => (
                    <SelectItem key={style} value={style}>{style}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
                {poolLengths.map(length => (
                  <Button
                    key={length}
                    variant={poolLengthFilter === length ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setPoolLengthFilter(length)}
                    className="flex-1 sm:flex-none min-w-[80px]"
                  >
                    {length}mプール
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-9 px-4 text-base">
                記録件数: {Object.values(groupedRecordsByStyle).reduce((acc, style) => acc + Object.keys(style).length, 0)}
              </Badge>
            </div>
          </div>
        </div>
      </PageHeader>

      <div className="container px-4 md:px-8">
        <Accordion type="multiple" defaultValue={swimStyles} className="space-y-4">
          {Object.entries(groupedRecordsByStyle).map(([style, records]) => (
            <AccordionItem key={style} value={style} className="border rounded-lg bg-card overflow-hidden">
              <AccordionTrigger className="px-6 hover:bg-muted/50 [&[data-state=open]>div>.chevron]:rotate-180">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-4">
                    <h3 className="text-xl font-bold">{style}</h3>
                    <Badge variant="secondary" className="font-semibold">
                      {Object.keys(records).length}件の記録
                    </Badge>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 chevron" />
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="px-6 pb-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    {Object.entries(records).map(([key, record]) => (
                      <Card key={key} className="overflow-hidden hover:shadow-lg transition-all duration-300 group border-2 hover:border-primary/20">
                        <CardHeader className="pb-4 bg-muted/30">
                          <CardTitle className="flex items-center justify-between">
                            <div className="flex items-baseline gap-2">
                              <span className="text-lg font-semibold">
                                {record.distance}m種目
                              </span>
                            </div>
                            {user?.role === 'coach' && (
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditingRecord(record.id)}
                                  className="h-8 w-8 hover:bg-background"
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
                        <CardContent className="pt-6 pb-6">
                          <div className="space-y-6">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2">
                                <p className="text-5xl font-bold tracking-tight text-primary">
                                  {formatTime(record.time)}
                                </p>
                                <div className="space-y-1">
                                  <p className="text-lg font-semibold">
                                    {record.athleteName}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {poolLengthFilter}mプール
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-3">
                                {record.isCompetition && (
                                  <Badge variant="default" className="px-2 py-1">
                                    大会記録
                                  </Badge>
                                )}
                                <time className="text-sm font-medium bg-muted/50 px-3 py-1 rounded-full">
                                  {new Date(record.date).toLocaleDateString('ja-JP', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </time>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

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
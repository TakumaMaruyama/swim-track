import React from 'react';
import { useSwimRecords } from '../hooks/use-swim-records';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Alert, AlertDescription } from "../components/ui/alert";
import { AlertCircle, Edit2, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { EditRecordForm } from '../components/EditRecordForm';
import { useUser } from '../hooks/use-user';
import { useToast } from '../hooks/use-toast';
import { PageHeader } from '../components/PageHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

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
  const [poolLengthFilter, setPoolLengthFilter] = React.useState<string>("all_pools");

  const swimStyles = [
    "自由形",
    "背泳ぎ",
    "平泳ぎ",
    "バタフライ",
    "個人メドレー"
  ];

  const poolLengths = [15, 25, 50];

  const formatDate = (date: string | Date | null) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('ja-JP');
  };

  const groupedRecords: GroupedRecords = React.useMemo(() => {
    if (!records) return {};
    return records.reduce((acc, record) => {
      // Apply filters
      if (styleFilter !== "all" && record.style !== styleFilter) return acc;
      if (poolLengthFilter !== "all_pools" && record.poolLength !== parseInt(poolLengthFilter)) return acc;

      const key = `${record.style}-${record.distance}-${record.poolLength}`;
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
  }, [records, styleFilter, poolLengthFilter]);

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

  const record = editingRecord ? records?.find(r => r.id === editingRecord) : undefined;

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
        <div className="flex gap-4">
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
              <SelectItem value="all_pools">すべてのプール</SelectItem>
              {poolLengths.map(length => (
                <SelectItem key={length} value={length.toString()}>{length}mプール</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PageHeader>

      <div className="container px-4 md:px-8">
        <Accordion type="single" collapsible className="space-y-4">
          {swimStyles.map(style => {
            const styleRecords = Object.entries(groupedRecords)
              .filter(([_, record]) => record.style === style);
            
            if (styleFilter !== "all" && style !== styleFilter) return null;
            if (styleRecords.length === 0) return null;

            return (
              <AccordionItem
                key={style}
                value={style}
                className="border rounded-lg px-6 bg-white shadow-sm"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold">{style}</h3>
                    <span className="text-sm text-muted-foreground">
                      ({styleRecords.length} 記録)
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pt-4">
                    {styleRecords.map(([key, record]) => (
                      <Card key={key} className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold">
                                {record.distance}m
                              </span>
                              <span className="text-sm text-muted-foreground">
                                ({record.poolLength}mプール)
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
                          <div className="space-y-4">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="text-sm text-muted-foreground">選手名</p>
                                <p className="text-lg font-semibold">{record.athleteName}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">記録</p>
                                <p className="text-2xl font-bold text-primary">{record.time}</p>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <p className="text-sm text-muted-foreground">
                                記録日: {formatDate(record.date)}
                              </p>
                              {record.isCompetition && (
                                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                                  大会記録
                                </span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {record && (
          <EditRecordForm
            record={record}
            isOpen={!!editingRecord}
            onClose={() => setEditingRecord(null)}
            onSubmit={async (data) => {
              try {
                const response = await fetch(`/api/records/${record.id}`, {
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
                setEditingRecord(null);
              } catch (error) {
                console.error('Error updating record:', error);
                toast({
                  variant: "destructive",
                  title: "エラー",
                  description: "記録の更新に失敗しました",
                });
                throw error;
              }
            }}
          />
        )}
      </div>
    </>
  );
}

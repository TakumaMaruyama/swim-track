import React from 'react';
import { useSwimRecords } from '../hooks/use-swim-records';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Edit2, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditRecordForm } from '../components/EditRecordForm';

import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '../components/PageHeader';
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const swimStyles = [
  "自由形",
  "背泳ぎ",
  "平泳ぎ",
  "バタフライ",
  "個人メドレー"
];

export default function AllTimeRecords() {
  
  const { toast } = useToast();
  const { records, isLoading, error, mutate } = useSwimRecords();
  const [editingRecord, setEditingRecord] = React.useState<number | null>(null);
  const [poolLengthFilter, setPoolLengthFilter] = React.useState<string>("25"); // デフォルトは25mプール

  const formatTime = (time: string) => {
    const [minutes, seconds] = time.split(':');
    if (!seconds) return time;
    return `${minutes}'${seconds}"`;
  };

  const groupedRecords: GroupedRecords = React.useMemo(() => {
    if (!records) return {};
    
    const filteredRecords = records.filter(record => 
      record.poolLength === parseInt(poolLengthFilter)
    );

    const groupedByDistance = filteredRecords.reduce((acc, record) => {
      if (!acc[record.distance]) {
        acc[record.distance] = {};
      }
      
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

    const sortedGrouped: GroupedRecords = {};
    Object.keys(groupedByDistance)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach(distance => {
        sortedGrouped[distance] = groupedByDistance[distance];
      });

    return sortedGrouped;
  }, [records, poolLengthFilter]);

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
      <PageHeader title="歴代記録" />
      
      <div className="container px-4 md:px-8">
        <Tabs defaultValue="25" value={poolLengthFilter} onValueChange={setPoolLengthFilter}>
          <TabsList className="mb-8">
            <TabsTrigger value="15">15mプール</TabsTrigger>
            <TabsTrigger value="25">25mプール</TabsTrigger>
            <TabsTrigger value="50">50mプール</TabsTrigger>
          </TabsList>

          {['15', '25', '50'].map((poolLength) => (
            <TabsContent key={poolLength} value={poolLength} className="space-y-8">
              {Object.entries(groupedRecords).map(([distance, styles]) => (
                <Card key={distance} className="overflow-hidden">
                  <CardHeader className="bg-muted/50">
                    <CardTitle className="text-2xl">
                      {distance}m種目
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(styles)
                        .sort(([styleA], [styleB]) => {
                          const indexA = swimStyles.indexOf(styleA);
                          const indexB = swimStyles.indexOf(styleB);
                          if (indexA === -1) return 1;
                          if (indexB === -1) return -1;
                          return indexA - indexB;
                        })
                        .map(([style, record]) => (
                          <div
                            key={`${distance}-${style}`}
                            className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold text-primary">
                                {style}
                              </h3>
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    toast({
                                      title: "情報",
                                      description: "記録の編集は管理者のみが可能です",
                                    });
                                  }}
                                  className="h-8 w-8"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold tracking-tight">
                                  {formatTime(record.time)}
                                </span>
                                {record.isCompetition && (
                                  <Badge variant="secondary" className="flex items-center gap-1">
                                    <Trophy className="h-3 w-3" />
                                    大会記録
                                  </Badge>
                                )}
                              </div>

                              <div className="space-y-1">
                                <p className="font-medium">
                                  {record.athleteName}
                                </p>
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
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          ))}
        </Tabs>

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
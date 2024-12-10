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

const Record = React.memo(({ record }: { record: GroupedRecord }) => {
  const formatTime = React.useCallback((time: string) => {
    const [minutes, seconds] = time.split(':');
    if (!seconds) return time;
    return `${minutes}'${seconds}"`;
  }, []);

  return (
    <div className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="space-y-4">
        <p className="text-xl text-primary font-bold">{record.style}</p>
        <div className="flex items-center gap-3">
          <p className="text-xl">{record.athleteName}</p>
          <p className="text-xl">{formatTime(record.time)}</p>
        </div>
        <time className="text-sm text-muted-foreground block">
          {new Date(record.date).toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </time>
        {record.isCompetition && (
          <Badge variant="secondary" className="inline-flex items-center gap-1">
            <Trophy className="h-3 w-3" />
            大会記録
          </Badge>
        )}
      </div>
    </div>
  );
});

Record.displayName = "Record";

function AllTimeRecords() {
  const { toast } = useToast();
  const { records, isLoading, error, mutate } = useSwimRecords({
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: 30000,
    dedupingInterval: 5000,
  });
  
  const [editingRecord, setEditingRecord] = React.useState<number | null>(null);
  const [poolLengthFilter, setPoolLengthFilter] = React.useState<string>("25");

  const groupedRecords: GroupedRecords = React.useMemo(() => {
    if (!records) return {};
    
    const filteredRecords = records.filter(record => 
      record.poolLength === parseInt(poolLengthFilter)
    );

    return filteredRecords.reduce((acc, record) => {
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
  }, [records, poolLengthFilter]);

  const sortedGroupedRecords = React.useMemo(() => {
    const sorted: GroupedRecords = {};
    Object.keys(groupedRecords)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach(distance => {
        sorted[distance] = groupedRecords[distance];
      });
    return sorted;
  }, [groupedRecords]);

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
            <TabsTrigger value="15">15ｍプール</TabsTrigger>
            <TabsTrigger value="25">25ｍプール（短水路）</TabsTrigger>
            <TabsTrigger value="50">50ｍプール（長水路）</TabsTrigger>
          </TabsList>

          {['15', '25', '50'].map((poolLength) => (
            <TabsContent key={poolLength} value={poolLength} className="space-y-8">
              {Object.entries(sortedGroupedRecords).map(([distance, styles]) => (
                <Card key={distance} className="overflow-hidden">
                  <CardHeader className="bg-muted/50">
                    <CardTitle className="text-xl">
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
                          <Record key={`${distance}-${style}`} record={record} />
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          ))}
        </Tabs>

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
      </div>
    </>
  );
}

export default AllTimeRecords;

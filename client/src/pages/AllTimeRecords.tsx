import React from 'react';
import { useSwimRecords } from '@/hooks/use-swim-records';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from '@/components/PageHeader';

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

const Record: React.FC<{ record: GroupedRecord }> = React.memo(({ record }) => {
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

function AllTimeRecords(): JSX.Element {
  const { records, isLoading, error } = useSwimRecords({
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: 30000,
    dedupingInterval: 5000,
  });
  
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
              {swimStyles.map((style) => (
                <Card key={style} className="overflow-hidden">
                  <CardHeader className="bg-muted/50">
                    <CardTitle className="text-xl">
                      {style}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(sortedGroupedRecords)
                        .sort(([distA], [distB]) => parseInt(distA) - parseInt(distB))
                        .map(([distance, styles]) => {
                          if (!styles[style]) return null;
                          return (
                            <Record key={`${style}-${distance}`} record={styles[style]} />
                          );
                        })
                        .filter(Boolean)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </>
  );
}

export default AllTimeRecords;
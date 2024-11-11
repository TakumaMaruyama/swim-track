import React from 'react';
import { useSwimRecords } from '../hooks/use-swim-records';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

type GroupedRecords = {
  [style: string]: {
    [distance: number]: {
      time: string;
      date: Date;
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
  const { records, isLoading, error } = useSwimRecords();

  const groupedRecords: GroupedRecords = React.useMemo(() => {
    if (!records) return {};

    return records.reduce((acc, record) => {
      if (!acc[record.style]) {
        acc[record.style] = {};
      }
      
      const currentBest = acc[record.style][record.distance];
      if (!currentBest || record.time < currentBest.time) {
        acc[record.style][record.distance] = {
          time: record.time,
          date: new Date(record.date),
        };
      }
      
      return acc;
    }, {} as GroupedRecords);
  }, [records]);

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
                    <p className="text-xl font-bold text-primary">{record.time}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

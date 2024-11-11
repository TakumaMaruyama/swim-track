import React from 'react';
import { useSwimRecords } from '../hooks/use-swim-records';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

type GroupedCompetitions = {
  [date: string]: {
    style: string;
    distance: number;
    time: string;
  }[];
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
};

export default function Competitions() {
  const { records, isLoading, error } = useSwimRecords(true);

  const groupedRecords: GroupedCompetitions = React.useMemo(() => {
    if (!records) return {};

    return records.reduce((acc, record) => {
      const date = formatDate(new Date(record.date));
      if (!acc[date]) {
        acc[date] = [];
      }
      
      acc[date].push({
        style: record.style,
        distance: record.distance,
        time: record.time,
      });
      
      return acc;
    }, {} as GroupedCompetitions);
  }, [records]);

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse text-lg">大会記録を読み込んでいます...</div>
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
            大会記録の取得中にエラーが発生しました。再度お試しください。
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container py-8 px-4 md:px-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-8">大会記録</h1>
      <div className="space-y-6">
        {Object.entries(groupedRecords)
          .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
          .map(([date, records]) => (
            <Card key={date} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-xl">{date}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {records.map((record, index) => (
                    <div 
                      key={index} 
                      className="flex flex-col p-4 rounded-lg bg-muted/50"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <p className="font-medium text-lg">{record.style}</p>
                        <p className="text-xl font-bold text-primary">{record.time}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {record.distance}m
                      </p>
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

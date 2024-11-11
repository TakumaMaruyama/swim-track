import React from 'react';
import { useSwimRecords } from '../hooks/use-swim-records';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type GroupedRecords = {
  [style: string]: {
    [distance: number]: {
      time: string;
      date: string;
    };
  };
};

export default function BestTimes() {
  const { records, isLoading } = useSwimRecords();

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
          date: record.date,
        };
      }
      
      return acc;
    }, {} as GroupedRecords);
  }, [records]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">読み込み中...</div>;
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">ベストタイム</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(groupedRecords).map(([style, distances]) => (
          <Card key={style}>
            <CardHeader>
              <CardTitle>{style}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(distances).map(([distance, record]) => (
                  <div key={distance} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{distance}m</p>
                      <p className="text-sm text-gray-500">
                        {new Date(record.date).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-xl font-bold">{record.time}</p>
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

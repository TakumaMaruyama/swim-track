import React from 'react';
import { useSwimRecords } from '../hooks/use-swim-records';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type GroupedCompetitions = {
  [date: string]: {
    style: string;
    distance: number;
    time: string;
  }[];
};

export default function Competitions() {
  const { records, isLoading } = useSwimRecords(true);

  const groupedRecords: GroupedCompetitions = React.useMemo(() => {
    if (!records) return {};

    return records.reduce((acc, record) => {
      const date = new Date(record.date).toLocaleDateString();
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
    return <div className="flex items-center justify-center min-h-screen">読み込み中...</div>;
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">大会記録</h1>
      <div className="space-y-4">
        {Object.entries(groupedRecords).map(([date, records]) => (
          <Card key={date}>
            <CardHeader>
              <CardTitle>{date}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {records.map((record, index) => (
                  <div key={index} className="flex justify-between items-center border-b pb-2 last:border-0">
                    <div>
                      <p className="font-medium">{record.style}</p>
                      <p className="text-sm text-gray-500">{record.distance}m</p>
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

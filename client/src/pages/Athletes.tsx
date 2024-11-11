import React from 'react';
import { useAthletes } from '../hooks/use-athletes';
import { useSwimRecords } from '../hooks/use-swim-records';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Athletes() {
  const { athletes, isLoading: athletesLoading } = useAthletes();
  const { records, isLoading: recordsLoading } = useSwimRecords();

  const getLatestPerformance = (studentId: number) => {
    if (!records) return null;
    return records
      .filter(record => record.studentId === studentId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  };

  if (athletesLoading || recordsLoading) {
    return <div className="flex items-center justify-center min-h-screen">読み込み中...</div>;
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">選手一覧</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {athletes?.map((athlete) => {
          const latestRecord = getLatestPerformance(athlete.id);
          return (
            <Card key={athlete.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-4">
                  <Avatar>
                    <AvatarFallback>
                      {athlete.username.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span>{athlete.username}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {latestRecord ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">最近の記録:</p>
                    <p>種目: {latestRecord.style}</p>
                    <p>距離: {latestRecord.distance}m</p>
                    <p>タイム: {latestRecord.time}</p>
                    <p className="text-sm text-gray-500">
                      記録日: {new Date(latestRecord.date).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">記録なし</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

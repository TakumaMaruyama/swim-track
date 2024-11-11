import React from 'react';
import { useAthletes } from '../hooks/use-athletes';
import { useSwimRecords } from '../hooks/use-swim-records';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function Athletes() {
  const { athletes, isLoading: athletesLoading, error: athletesError } = useAthletes();
  const { records, isLoading: recordsLoading, error: recordsError } = useSwimRecords();

  const getLatestPerformance = (studentId: number) => {
    if (!records) return null;
    return records
      .filter(record => record.studentId === studentId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  };

  if (athletesLoading || recordsLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse text-lg">データを読み込んでいます...</div>
        </div>
      </div>
    );
  }

  if (athletesError || recordsError) {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            データの取得中にエラーが発生しました。再度お試しください。
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container py-8 px-4 md:px-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-8">選手一覧</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {athletes?.map((athlete) => {
          const latestRecord = getLatestPerformance(athlete.id);
          return (
            <Card key={athlete.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {athlete.username.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="text-lg">{athlete.username}</span>
                    <p className="text-sm text-muted-foreground mt-1">選手</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {latestRecord ? (
                  <div className="space-y-3">
                    <h3 className="font-medium text-sm text-muted-foreground">最近の記録:</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-sm font-medium">種目</p>
                        <p className="text-base">{latestRecord.style}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">距離</p>
                        <p className="text-base">{latestRecord.distance}m</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">タイム</p>
                        <p className="text-base font-bold">{latestRecord.time}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">日付</p>
                        <p className="text-base">
                          {new Date(latestRecord.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">記録なし</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

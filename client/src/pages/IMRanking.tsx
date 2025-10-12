import React from 'react';
import { useSwimRecords } from '@/hooks/use-swim-records';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Trophy } from "lucide-react";
import { PageHeader } from '@/components/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type RankingRecord = {
  id: number;
  athleteName: string;
  time: string;
  date: Date;
  studentId: number;
  rank: number;
};

type RankingByDistance = {
  [distance: number]: RankingRecord[];
};

const getMedalEmoji = (rank: number): string => {
  switch (rank) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return '';
  }
};

const formatTime = (time: string): string => {
  const [minutes, seconds] = time.split(':');
  if (!seconds) return time;
  return `${minutes}'${seconds}"`;
};

const getCurrentMeasurementMonth = (): Date => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const targetMonth = currentMonth % 2 === 0 
    ? currentMonth  // 偶数月ならそのまま
    : currentMonth - 1; // 奇数月なら-1
  return new Date(now.getFullYear(), targetMonth - 1);
};

const RankingTable: React.FC<{ rankings: RankingByDistance }> = ({ rankings }) => {
  const distances = [60, 120];

  if (Object.keys(rankings).length === 0) {
    return (
      <Alert className="my-4">
        <AlertDescription>
          該当する測定記録が見つかりませんでした。
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {distances.map(distance => {
        const records = rankings[distance] || [];
        
        return (
          <Card key={distance}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Trophy className="h-5 w-5 text-blue-600" />
                <span>{distance}m IM</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {records.length === 0 ? (
                <p className="text-muted-foreground">記録なし</p>
              ) : (
                <div className="space-y-3">
                  {records.map((record) => (
                    <div 
                      key={record.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <span className="text-2xl">{getMedalEmoji(record.rank)}</span>
                        <div>
                          <p className="font-semibold text-lg">{record.rank}位</p>
                        </div>
                        <div>
                          <p className="text-lg">{record.athleteName}</p>
                          <time className="text-xs text-muted-foreground">
                            {new Date(record.date).toLocaleDateString('ja-JP', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </time>
                        </div>
                      </div>
                      <div>
                        <p className="text-xl font-bold text-primary">{formatTime(record.time)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

function IMRanking(): JSX.Element {
  const { records, isLoading, error } = useSwimRecords();

  const measurementMonth = React.useMemo(() => getCurrentMeasurementMonth(), []);
  
  const measurementMonthText = React.useMemo(() => {
    return measurementMonth.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long'
    }) + '測定';
  }, [measurementMonth]);

  const { maleRankings, femaleRankings } = React.useMemo(() => {
    if (!records) return { maleRankings: {}, femaleRankings: {} };

    try {
      const targetYear = measurementMonth.getFullYear();
      const targetMonth = measurementMonth.getMonth(); // 0-11

      const imRecords = records.filter(record => {
        const recordDate = new Date(record.date || Date.now());
        const recordYear = recordDate.getFullYear();
        const recordMonth = recordDate.getMonth();
        
        return (
          record.poolLength === 15 &&
          record.style === '個人メドレー' &&
          (record.distance === 60 || record.distance === 120) &&
          recordYear === targetYear &&
          recordMonth === targetMonth
        );
      });

      const processGenderRecords = (gender: 'male' | 'female'): RankingByDistance => {
        const genderRecords = imRecords.filter(r => r.gender === gender);
        const byDistance: { [distance: number]: RankingRecord[] } = {};

        [60, 120].forEach(distance => {
          const distanceRecords = genderRecords
            .filter(r => r.distance === distance)
            .sort((a, b) => {
              const timeA = a.time.split(':').reduce((acc, val) => acc * 60 + parseFloat(val), 0);
              const timeB = b.time.split(':').reduce((acc, val) => acc * 60 + parseFloat(val), 0);
              return timeA - timeB;
            })
            .slice(0, 3)
            .map((record, index) => ({
              id: record.id,
              athleteName: record.athleteName || '',
              time: record.time,
              date: new Date(record.date || Date.now()),
              studentId: record.studentId,
              rank: index + 1
            }));

          byDistance[distance] = distanceRecords;
        });

        return byDistance;
      };

      return {
        maleRankings: processGenderRecords('male'),
        femaleRankings: processGenderRecords('female')
      };
    } catch (err) {
      console.error("Error processing IM rankings:", err);
      return { maleRankings: {}, femaleRankings: {} };
    }
  }, [records, measurementMonth]);

  if (error) {
    return (
      <>
        <PageHeader title="IM測定ランキング" />
        <div className="container">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              データの読み込み中にエラーが発生しました。しばらくしてからもう一度お試しください。
            </AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="IM測定ランキング" />
      <div className="container">
        <div className="mb-6">
          <div className="flex items-center space-x-2 text-muted-foreground">
            <span className="text-lg">📅</span>
            <p className="text-lg font-medium">{measurementMonthText}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center my-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <Tabs defaultValue="male" className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="male">男子</TabsTrigger>
              <TabsTrigger value="female">女子</TabsTrigger>
            </TabsList>
            <TabsContent value="male" className="mt-6">
              <RankingTable rankings={maleRankings} />
            </TabsContent>
            <TabsContent value="female" className="mt-6">
              <RankingTable rankings={femaleRankings} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </>
  );
}

export default IMRanking;

import React from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, TrendingUp, ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useSwimRecords } from '@/hooks/use-swim-records';

type GrowthRecord = {
  rank: number;
  athleteName: string;
  studentId: number;
  previousTime: string;
  currentTime: string;
  growthRate: number;
  improvementSeconds: number;
  previousDate: Date;
  currentDate: Date;
};

// 記録データから直近2回の偶数月を取得
function getLatestTwoEvenMonths(records: any[]): { current: { year: number; month: number } | null; previous: { year: number; month: number } | null } {
  // 個人メドレーの記録から偶数月を抽出
  const evenMonths = records
    .filter(record => 
      record.style === '個人メドレー' && 
      record.poolLength === 15 &&
      record.date
    )
    .map(record => {
      const date = new Date(record.date);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      // 偶数月のみ
      if (month % 2 === 0) {
        return { year, month, timestamp: date.getTime() };
      }
      return null;
    })
    .filter(item => item !== null) as { year: number; month: number; timestamp: number }[];

  // 重複を除去してタイムスタンプでソート
  const uniqueMonths = Array.from(
    new Map(
      evenMonths.map(item => [`${item.year}-${item.month}`, item])
    ).values()
  ).sort((a, b) => b.timestamp - a.timestamp);

  if (uniqueMonths.length < 2) {
    return { current: null, previous: null };
  }

  return {
    current: { year: uniqueMonths[0].year, month: uniqueMonths[0].month },
    previous: { year: uniqueMonths[1].year, month: uniqueMonths[1].month },
  };
}

// タイムを秒数に変換
function timeToSeconds(time: string): number {
  const [minutes, seconds] = time.split(':').map(parseFloat);
  return minutes * 60 + seconds;
}

// タイムをフォーマット
function formatTime(time: string): string {
  const [minutes, seconds] = time.split(':');
  if (!seconds) return time;
  return `${minutes}'${seconds}"`;
}

export default function GrowthRankings() {
  const [, navigate] = useLocation();
  const { records, isLoading, error } = useSwimRecords();

  // 伸び率ランキングを計算
  const growthRankings = React.useMemo(() => {
    if (!records) return null;

    // 記録データから直近2回の偶数月を取得
    const { current: currentPeriod, previous: previousPeriod } = getLatestTwoEvenMonths(records);

    // データが不足している場合
    if (!currentPeriod || !previousPeriod) {
      return { periods: null, rankings: null };
    }

    // 個人メドレーの記録のみ抽出（15mプール）
    const imRecords = records.filter(record => 
      record.style === '個人メドレー' && 
      record.poolLength === 15 &&
      record.date
    );

    // 最新月の記録
    const currentRecords = imRecords.filter(record => {
      const recordDate = new Date(record.date!);
      return recordDate.getFullYear() === currentPeriod.year && 
             recordDate.getMonth() + 1 === currentPeriod.month;
    });

    // 前回月の記録
    const previousRecords = imRecords.filter(record => {
      const recordDate = new Date(record.date!);
      return recordDate.getFullYear() === previousPeriod.year && 
             recordDate.getMonth() + 1 === previousPeriod.month;
    });

    // 伸び率を計算する関数
    const calculateGrowth = (distance: number, gender: 'male' | 'female'): GrowthRecord[] => {
      const currentFiltered = currentRecords.filter(r => r.distance === distance && r.gender === gender);
      const previousFiltered = previousRecords.filter(r => r.distance === distance && r.gender === gender);

      const growthData: GrowthRecord[] = [];

      // 両方の期間に記録がある選手のみ処理
      currentFiltered.forEach(currentRecord => {
        const previousRecord = previousFiltered.find(
          prev => prev.studentId === currentRecord.studentId
        );

        if (previousRecord) {
          const currentSeconds = timeToSeconds(currentRecord.time);
          const previousSeconds = timeToSeconds(previousRecord.time);
          
          // 伸び率 = (前回 - 今回) / 前回 × 100
          const improvementSeconds = previousSeconds - currentSeconds;
          const growthRate = (improvementSeconds / previousSeconds) * 100;

          growthData.push({
            rank: 0,
            athleteName: currentRecord.athleteName || '不明',
            studentId: currentRecord.studentId!,
            previousTime: previousRecord.time,
            currentTime: currentRecord.time,
            growthRate,
            improvementSeconds,
            previousDate: new Date(previousRecord.date!),
            currentDate: new Date(currentRecord.date!),
          });
        }
      });

      // 伸び率の高い順にソート
      return growthData
        .sort((a, b) => b.growthRate - a.growthRate)
        .map((record, index) => ({ ...record, rank: index + 1 }))
        .slice(0, 10); // 上位10位まで
    };

    return {
      periods: {
        current: currentPeriod,
        previous: previousPeriod,
      },
      rankings: {
        '60m': {
          male: calculateGrowth(60, 'male'),
          female: calculateGrowth(60, 'female'),
        },
        '120m': {
          male: calculateGrowth(120, 'male'),
          female: calculateGrowth(120, 'female'),
        },
      },
    };
  }, [records]);

  const GrowthTable: React.FC<{
    title: string;
    rankings: GrowthRecord[];
  }> = ({ title, rankings }) => {
    const getGrowthIcon = (rate: number) => {
      if (rate > 0) return <ArrowUp className="h-4 w-4 text-green-600" />;
      if (rate < 0) return <ArrowDown className="h-4 w-4 text-red-600" />;
      return null;
    };

    const getGrowthColor = (rate: number) => {
      if (rate > 0) return 'text-green-600';
      if (rate < 0) return 'text-red-600';
      return 'text-gray-600';
    };

    return (
      <div className="space-y-3">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          {title === '男子' ? '🏊‍♂️' : '🏊‍♀️'} {title}
        </h3>
        {rankings.length === 0 ? (
          <p className="text-sm text-muted-foreground">両期間の記録がある選手がいません</p>
        ) : (
          <div className="space-y-2">
            {rankings.map((record) => (
              <div
                key={record.studentId}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                    {record.rank}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{record.athleteName}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>{formatTime(record.previousTime)}</span>
                      <span>→</span>
                      <span>{formatTime(record.currentTime)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`flex items-center gap-1 font-bold ${getGrowthColor(record.growthRate)}`}>
                    {getGrowthIcon(record.growthRate)}
                    <span>{record.growthRate > 0 ? '+' : ''}{record.growthRate.toFixed(2)}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {record.improvementSeconds > 0 ? '-' : '+'}{Math.abs(record.improvementSeconds).toFixed(2)}秒
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500">エラーが発生しました</p>
      </div>
    );
  }

  // データ不足の場合
  if (!growthRankings?.periods) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                className="shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-600 flex items-center gap-2">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                  伸び率ランキング
                </h1>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="py-12 text-center">
              <TrendingUp className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <p className="text-lg text-muted-foreground mb-2">
                伸び率を計算するには直近2回の偶数月の記録が必要です
              </p>
              <p className="text-sm text-muted-foreground">
                個人メドレー（15mプール）の記録を2回以上登録してください
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const { current: currentPeriod, previous: previousPeriod } = growthRankings.periods;
  const currentMonthName = `${currentPeriod.year}年${currentPeriod.month}月`;
  const previousMonthName = `${previousPeriod.year}年${previousPeriod.month}月`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-600 flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-blue-600" />
                伸び率ランキング
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                {previousMonthName} → {currentMonthName}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* 60m 個人メドレー */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">
                60m 個人メドレー
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              {growthRankings.rankings && (
                <>
                  <GrowthTable title="男子" rankings={growthRankings.rankings['60m'].male} />
                  <GrowthTable title="女子" rankings={growthRankings.rankings['60m'].female} />
                </>
              )}
            </CardContent>
          </Card>

          {/* 120m 個人メドレー */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">
                120m 個人メドレー
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              {growthRankings.rankings && (
                <>
                  <GrowthTable title="男子" rankings={growthRankings.rankings['120m'].male} />
                  <GrowthTable title="女子" rankings={growthRankings.rankings['120m'].female} />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

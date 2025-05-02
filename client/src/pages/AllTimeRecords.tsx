import React from 'react';
import { useSwimRecords } from '@/hooks/use-swim-records';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { PageHeader } from '@/components/PageHeader';
import { GenderSelector } from '@/components/GenderSelector';
import { PoolLengthSelector } from '@/components/PoolLengthSelector';
import { PoolCourseSelector } from '@/components/PoolCourseSelector';

type GroupedRecord = {
  id: number;
  style: string;
  distance: number;
  time: string;
  date: Date;
  studentId: number;
  poolLength: number;
  athleteName: string;
  gender: 'male' | 'female';
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
      <div className="space-y-3">
        <p className="text-lg sm:text-xl text-primary font-bold">{record.style}</p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <p className="text-base sm:text-xl">{record.athleteName}</p>
          <p className="text-base sm:text-xl font-semibold">{formatTime(record.time)}</p>
        </div>
        <time className="text-xs sm:text-sm text-muted-foreground block">
          {new Date(record.date).toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </time>
      </div>
    </div>
  );
});

Record.displayName = "Record";

function AllTimeRecords(): JSX.Element {
  const { records, isLoading, error, mutate } = useSwimRecords();

  const [genderFilter, setGenderFilter] = React.useState<'male' | 'female'>('male');
  const [poolCourseFilter, setPoolCourseFilter] = React.useState<'short' | 'long'>('short');
  const [distanceFilter, setDistanceFilter] = React.useState<string | null>(null);

  // Transform pool course to actual pool length (25m or 50m)
  const poolLengthValue = React.useMemo(() => {
    return poolCourseFilter === 'short' ? "25" : "50";
  }, [poolCourseFilter]);

  const groupedRecords: GroupedRecords = React.useMemo(() => {
    if (!records) return {};

    try {
      const filteredRecords = records.filter(record => {
        return record.poolLength === parseInt(poolLengthValue) &&
               record.gender === genderFilter &&
               (!distanceFilter || record.distance === parseInt(distanceFilter));
      });

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
            poolLength: record.poolLength,
            athleteName: record.athleteName || '',
            gender: record.gender
          };
        }
        return acc;
      }, {} as GroupedRecords);
    } catch (err) {
      console.error("Error processing records:", err);
      return {};
    }
  }, [records, poolLengthValue, genderFilter, distanceFilter]);

  // Sort distances in ascending order
  const sortedDistances = React.useMemo(() => {
    return Object.keys(groupedRecords)
      .map(Number)
      .sort((a, b) => a - b);
  }, [groupedRecords]);

  // Get all available distances from records for the current filter settings
  const availableDistances = React.useMemo(() => {
    if (!records) return [];
    
    return [...new Set(
      records
        .filter(r => r.poolLength === parseInt(poolLengthValue) && r.gender === genderFilter)
        .map(r => r.distance)
    )].sort((a, b) => a - b);
  }, [records, poolLengthValue, genderFilter]);

  // Set the first available distance when filters change
  React.useEffect(() => {
    if (availableDistances.length > 0 && (!distanceFilter || !availableDistances.includes(parseInt(distanceFilter)))) {
      setDistanceFilter(availableDistances[0].toString());
    }
  }, [availableDistances, distanceFilter]);

  if (error) {
    return (
      <>
        <PageHeader title="歴代記録" />
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
      <PageHeader title="歴代記録" />
      <div className="container">
        <div className="space-y-6">
          {/* 性別フィルター */}
          <div>
            <p className="text-sm font-medium mb-2">性別</p>
            <GenderSelector
              value={genderFilter}
              onChange={setGenderFilter}
              className="w-full"
            />
          </div>
          
          {/* 短水路/長水路フィルター */}
          <div>
            <p className="text-sm font-medium mb-2">水路</p>
            <PoolCourseSelector
              value={poolCourseFilter}
              onChange={setPoolCourseFilter}
              className="w-full"
            />
          </div>
          
          {/* 距離フィルター */}
          <div>
            <p className="text-sm font-medium mb-2">距離</p>
            <div className="flex flex-wrap gap-2">
              {availableDistances.map(distance => (
                <button
                  key={distance}
                  className={`px-4 py-2 rounded-md border ${
                    distanceFilter === distance.toString() 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-background hover:bg-muted/50"
                  }`}
                  onClick={() => setDistanceFilter(distance.toString())}
                >
                  {distance}m
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center my-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-6">
            {sortedDistances.length === 0 ? (
              <Alert className="my-4">
                <AlertDescription>
                  対象となる記録が見つかりませんでした。条件を変えてお試しください。
                </AlertDescription>
              </Alert>
            ) : (
              sortedDistances.map(distance => (
                <Card key={distance} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl">{distance}m</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
                      {swimStyles.map(style => {
                        const record = groupedRecords[distance]?.[style];
                        if (!record) return null;
                        return <Record key={`${distance}-${style}`} record={record} />;
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default AllTimeRecords;
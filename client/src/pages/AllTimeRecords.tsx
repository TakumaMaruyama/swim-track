import React from 'react';
import { useSwimRecords } from '@/hooks/use-swim-records';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Filter, Medal, Trash2, Edit2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditRecordForm } from '@/components/EditRecordForm';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
  competitionName?: string;
};

type GroupedRecords = {
  [key: string]: GroupedRecord[];
};

const swimStyles = [
  "自由形",
  "背泳ぎ",
  "平泳ぎ",
  "バタフライ",
  "個人メドレー"
];

const distances = [25, 50, 100, 200, 400, 800, 1500];
const poolLengths = [15, 25, 50];

const formatDate = (date: string | Date | null) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export default function AllTimeRecords() {
  const { user } = useUser();
  const { toast } = useToast();
  const { records, isLoading, error, mutate } = useSwimRecords();
  const [editingRecord, setEditingRecord] = React.useState<number | null>(null);
  const [styleFilter, setStyleFilter] = React.useState<string>("all");
  const [distanceFilter, setDistanceFilter] = React.useState<string>("all");
  const [poolLengthFilter, setPoolLengthFilter] = React.useState<string>("all");

  const groupedRecords: GroupedRecords = React.useMemo(() => {
    if (!records) return {};

    const filtered = records.filter(record => {
      if (styleFilter !== "all" && record.style !== styleFilter) return false;
      if (distanceFilter !== "all" && record.distance !== parseInt(distanceFilter)) return false;
      if (poolLengthFilter !== "all" && record.poolLength !== parseInt(poolLengthFilter)) return false;
      return true;
    });

    // Sort records by time (fastest first) within each group
    filtered.sort((a, b) => a.time.localeCompare(b.time));

    return filtered.reduce((acc, record) => {
      const key = `${record.style}-${record.distance}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      // Only add if it's a better time or from a different pool length
      const existingForPool = acc[key].find(r => r.poolLength === record.poolLength);
      if (!existingForPool || record.time < existingForPool.time) {
        if (existingForPool) {
          // Replace existing record for this pool length
          acc[key] = acc[key].filter(r => r.poolLength !== record.poolLength);
        }
        acc[key].push(record);
        // Sort by pool length for consistent display order
        acc[key].sort((a, b) => a.poolLength - b.poolLength);
      }
      return acc;
    }, {} as GroupedRecords);
  }, [records, styleFilter, distanceFilter, poolLengthFilter]);

  const handleEdit = async (recordId: number, data: any) => {
    try {
      const response = await fetch(`/api/records/${recordId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to update record');
      }

      await mutate();
      toast({
        title: "更新成功",
        description: "記録が更新されました",
      });
    } catch (error) {
      console.error('Error updating record:', error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "記録の更新に失敗しました",
      });
      throw error;
    }
  };

  const handleDelete = async (recordId: number) => {
    if (!confirm('この記録を削除してもよろしいですか？')) {
      return;
    }

    try {
      const response = await fetch(`/api/records/${recordId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete record');
      }

      await mutate();
      toast({
        title: "削除成功",
        description: "記録が削除されました",
      });
    } catch (error) {
      console.error('Error deleting record:', error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "記録の削除に失敗しました",
      });
    }
  };

  const record = records?.find(r => r.id === editingRecord);

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
      <div className="container px-4 space-y-8">
        {/* フィルターセクション */}
        <Card className="max-w-5xl mx-auto bg-gradient-to-br from-background/80 to-muted/30 border-primary/10 shadow-lg">
          <CardHeader className="border-b bg-muted/5">
            <CardTitle className="flex items-center gap-3">
              <span className="bg-primary/10 p-2.5 rounded-xl">
                <Filter className="h-5 w-5 text-primary" />
              </span>
              記録フィルター
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">種目</label>
                <Select value={styleFilter} onValueChange={setStyleFilter}>
                  <SelectTrigger className="bg-background/50 backdrop-blur-sm border-primary/20 hover:border-primary/40 transition-colors">
                    <SelectValue placeholder="種目で絞り込み" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべての種目</SelectItem>
                    {swimStyles.map(style => (
                      <SelectItem key={style} value={style}>{style}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">距離</label>
                <Select value={distanceFilter} onValueChange={setDistanceFilter}>
                  <SelectTrigger className="bg-background/50 backdrop-blur-sm border-primary/20 hover:border-primary/40 transition-colors">
                    <SelectValue placeholder="距離で絞り込み" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべての距離</SelectItem>
                    {distances.map(distance => (
                      <SelectItem key={distance} value={distance.toString()}>{distance}m</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">プール長</label>
                <Select value={poolLengthFilter} onValueChange={setPoolLengthFilter}>
                  <SelectTrigger className="bg-background/50 backdrop-blur-sm border-primary/20 hover:border-primary/40 transition-colors">
                    <SelectValue placeholder="プール長で絞り込み" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべてのプール</SelectItem>
                    {poolLengths.map(length => (
                      <SelectItem key={length} value={length.toString()}>{length}mプール</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 記録一覧セクション */}
        <div className="grid gap-8 max-w-7xl mx-auto">
          {swimStyles.map(style => {
            const styleRecords = Object.entries(groupedRecords)
              .filter(([key]) => key.startsWith(style))
              .reduce((acc, [key, records]) => {
                const [, distance] = key.split('-');
                acc[distance] = records;
                return acc;
              }, {} as { [key: string]: GroupedRecord[] });

            if (Object.keys(styleRecords).length === 0) return null;

            return (
              <div key={style} className="bg-gradient-to-b from-card/98 via-card/95 to-background rounded-xl border border-primary/20 shadow-lg overflow-hidden transition-all duration-500 ease-in-out hover:shadow-xl hover:border-primary/30 hover:from-card/95 hover:via-card/90">
                <div className="bg-gradient-to-r from-primary/30 via-primary/25 to-transparent px-6 py-4 border-b border-primary/15 backdrop-blur-sm sticky top-0 z-10">
                  <h2 className="text-2xl font-bold text-primary flex items-center gap-3">
                    <span className="bg-primary/25 p-2.5 rounded-xl shadow-md transition-all duration-500 ease-in-out group-hover:bg-primary/30 group-hover:shadow-lg">
                      <Medal className="w-6 h-6 text-primary" />
                    </span>
                    {style}
                  </h2>
                </div>
                <div className="p-6">
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
                    {Object.entries(styleRecords).map(([distance, records]) => {
                      const bestRecordsByPool = records.reduce((acc, record) => {
                        if (!acc[record.poolLength] || record.time < acc[record.poolLength].time) {
                          acc[record.poolLength] = record;
                        }
                        return acc;
                      }, {} as { [key: number]: GroupedRecord });

                      return (
                        <Card 
                          key={`${style}-${distance}`} 
                          className="overflow-hidden border-primary/10 hover:border-primary/20 transition-all duration-500 shadow-sm hover:shadow-md group bg-gradient-to-br from-background/95 to-background/50"
                        >
                          <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-primary/5">
                            <CardTitle className="flex items-center gap-2">
                              <span className="text-xl font-bold">{distance}m</span>
                              <Badge 
                                variant="outline" 
                                className="ml-2 bg-background/50 text-primary border-primary/20"
                              >
                                {Object.keys(bestRecordsByPool).length} 記録
                              </Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-4">
                            <div className="space-y-4">
                              {Object.values(bestRecordsByPool).map((record) => (
                                <div
                                  key={record.id}
                                  className={cn(
                                    "group/record relative rounded-xl border p-4",
                                    "bg-gradient-to-br from-card/95 via-card/90 to-background",
                                    "transition-all duration-500 ease-in-out",
                                    "hover:shadow-lg hover:scale-[1.02] hover:border-primary/30",
                                    "hover:from-card/98 hover:via-card/95 hover:to-background",
                                    record.isCompetition ? "ring-2 ring-primary/30" : "",
                                    "transform-gpu backface-visible",
                                    "flex flex-col gap-3"
                                  )}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge 
                                        variant="outline" 
                                        className={cn(
                                          "px-3 py-1 text-sm font-medium",
                                          "bg-background/50 backdrop-blur-sm border-primary/20",
                                          "transition-all duration-300",
                                          "group-hover/record:bg-primary/10",
                                          "group-hover/record:border-primary/30"
                                        )}
                                      >
                                        {record.poolLength}mプール
                                      </Badge>
                                      {record.isCompetition && (
                                        <Badge 
                                          variant="secondary" 
                                          className={cn(
                                            "gap-2 px-3 py-1",
                                            "bg-primary/20 text-primary font-semibold",
                                            "group-hover/record:bg-primary/30",
                                            "transition-all duration-500 ease-in-out",
                                            "shadow-sm group-hover/record:shadow-md",
                                            "scale-100 group-hover/record:scale-105",
                                            "flex items-center"
                                          )}
                                        >
                                          <Trophy className="h-3.5 w-3.5" />
                                          大会記録
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {formatDate(record.date)}
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-3">
                                    <div className="text-4xl font-bold text-primary tracking-tight">
                                      {record.time}
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-base font-semibold">
                                            {record.athleteName}
                                          </span>
                                          {record.competitionName && (
                                            <Badge
                                              variant="secondary"
                                              className="bg-muted/50 text-muted-foreground text-xs"
                                            >
                                              {record.competitionName}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                      {user?.role === 'coach' && (
                                        <div className="flex gap-2 opacity-0 transition-opacity group-hover/record:opacity-100">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setEditingRecord(record.id)}
                                            className={cn(
                                              "h-8 w-8 p-0",
                                              "hover:bg-primary/10 hover:text-primary",
                                              "transition-all duration-300"
                                            )}
                                          >
                                            <Edit2 className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(record.id)}
                                            className={cn(
                                              "h-8 w-8 p-0",
                                              "hover:bg-destructive/10 hover:text-destructive",
                                              "transition-all duration-300"
                                            )}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <EditRecordForm
          record={record}
          isOpen={!!editingRecord}
          onClose={() => setEditingRecord(null)}
          onSubmit={async (data) => {
            if (record) {
              await handleEdit(record.id, data);
            }
          }}
        />
      </div>
    </>
  );
}

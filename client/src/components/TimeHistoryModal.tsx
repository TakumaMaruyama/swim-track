import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trophy, Trash2, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import type { ExtendedSwimRecord } from "@/hooks/use-swim-records";
import { lazy, Suspense } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { EditRecordForm } from '@/components/EditRecordForm';

const TimeProgressChart = lazy(() => import('./TimeProgressChart'));

type TimeHistoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  records: ExtendedSwimRecord[];
  athleteName: string;
  onRecordDeleted?: () => Promise<void>;
  isAdmin: boolean;
};

type GroupedRecords = {
  [key: string]: ExtendedSwimRecord[];
};

const swimStyles = [
  "自由形",
  "背泳ぎ",
  "平泳ぎ",
  "バタフライ",
  "個人メドレー"
];

const formatDate = (date: string | Date | null) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('ja-JP');
};

export function TimeHistoryModal({ 
  isOpen, 
  onClose, 
  records, 
  athleteName,
  onRecordDeleted,
  isAdmin
}: TimeHistoryModalProps) {
  const { toast } = useToast();
  
  const [styleFilter, setStyleFilter] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState<string>("date_desc");
  const [deletingRecord, setDeletingRecord] = React.useState<number | null>(null);
  const [editingRecord, setEditingRecord] = React.useState<ExtendedSwimRecord | null>(null);
  const [periodFilter, setPeriodFilter] = React.useState<string>("all");
  const [customStartDate, setCustomStartDate] = React.useState<string>("");
  const [customEndDate, setCustomEndDate] = React.useState<string>("");
  const [isDeleting, setIsDeleting] = React.useState(false);

  const filterRecordsByDate = React.useCallback((record: ExtendedSwimRecord, now: Date) => {
    if (!record.date || periodFilter === "all") return true;
    
    const recordDate = new Date(record.date);
    
    switch (periodFilter) {
      case "1month": {
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(now.getMonth() - 1);
        return recordDate >= oneMonthAgo;
      }
      case "3months": {
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        return recordDate >= threeMonthsAgo;
      }
      case "6months": {
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(now.getMonth() - 6);
        return recordDate >= sixMonthsAgo;
      }
      case "1year": {
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(now.getFullYear() - 1);
        return recordDate >= oneYearAgo;
      }
      case "custom": {
        const startDate = customStartDate ? new Date(customStartDate) : null;
        const endDate = customEndDate ? new Date(customEndDate) : null;
        
        if (startDate && endDate) {
          return recordDate >= startDate && recordDate <= endDate;
        } else if (startDate) {
          return recordDate >= startDate;
        } else if (endDate) {
          return recordDate <= endDate;
        }
      }
      default:
        return true;
    }
  }, [periodFilter, customStartDate, customEndDate]);

  const groupedAndFilteredRecords: GroupedRecords = React.useMemo(() => {
    const now = new Date();
    const filtered = records.filter(record => {
      if (styleFilter !== "all" && record.style !== styleFilter) {
        return false;
      }
      return filterRecordsByDate(record, now);
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "date_asc":
          return (a.date ? new Date(a.date).getTime() : 0) - 
                 (b.date ? new Date(b.date).getTime() : 0);
        case "date_desc":
          return (b.date ? new Date(b.date).getTime() : 0) - 
                 (a.date ? new Date(a.date).getTime() : 0);
        case "time_asc":
          return a.time.localeCompare(b.time);
        case "time_desc":
          return b.time.localeCompare(a.time);
        default:
          return 0;
      }
    });

    return sorted.reduce((acc, record) => {
      const key = `${record.style}-${record.distance}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(record);
      return acc;
    }, {} as GroupedRecords);
  }, [records, styleFilter, sortBy, filterRecordsByDate]);

  const personalBests = React.useMemo(() => {
    const bests: { [key: string]: string } = {};
    Object.values(groupedAndFilteredRecords).forEach((records) => {
      // Group records by pool length
      const recordsByPool = records.reduce((acc, record) => {
        const key = `${record.style}-${record.distance}-${record.poolLength}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(record);
        return acc;
      }, {} as { [key: string]: ExtendedSwimRecord[] });

      // Calculate best time for each pool length
      Object.entries(recordsByPool).forEach(([key, poolRecords]) => {
        bests[key] = poolRecords.reduce((best, record) => 
          record.time < best ? record.time : best
        , poolRecords[0].time);
      });
    });
    return bests;
  }, [groupedAndFilteredRecords]);

  const handleDelete = async (recordId: number) => {
    if (isDeleting) return; // 既に削除処理中の場合は何もしない
    
    try {
      setIsDeleting(true);
      console.log('Attempting to delete record:', recordId);
      
      const response = await fetch(`/api/records/${recordId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();
      console.log('Delete response:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete record');
      }

      if (data.success) {
        toast({
          title: "削除成功",
          description: "記録が削除されました",
        });

        if (onRecordDeleted) {
          try {
            console.log('Refreshing data after deletion...');
            await onRecordDeleted();
            console.log('Data refresh completed');
          } catch (refreshError) {
            console.error('Error refreshing data:', refreshError);
            toast({
              variant: "destructive",
              title: "警告",
              description: "記録は削除されましたが、表示の更新に失敗しました。",
            });
          }
        }
      } else {
        throw new Error(data.message || 'Failed to delete record');
      }
    } catch (error) {
      console.error('Error deleting record:', error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: error instanceof Error ? error.message : "記録の削除に失敗しました",
      });
    } finally {
      setIsDeleting(false);
      setDeletingRecord(null);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={() => {
        setEditingRecord(null);
        onClose();
      }}>
        <DialogContent className="max-w-4xl h-[90vh] sm:h-[80vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl sm:text-2xl">{athleteName}の記録履歴</DialogTitle>
            <DialogDescription>
              選手の記録の推移と詳細を表示します
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={styleFilter} onValueChange={setStyleFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="種目で絞り込み" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべての種目</SelectItem>
                  {swimStyles.map(style => (
                    <SelectItem key={style} value={style}>{style}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="期間で絞り込み" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべての期間</SelectItem>
                  <SelectItem value="1month">過去1ヶ月</SelectItem>
                  <SelectItem value="3months">過去3ヶ月</SelectItem>
                  <SelectItem value="6months">過去6ヶ月</SelectItem>
                  <SelectItem value="1year">過去1年</SelectItem>
                  <SelectItem value="custom">カスタム期間</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="並び替え" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_desc">日付 (新しい順)</SelectItem>
                  <SelectItem value="date_asc">日付 (古い順)</SelectItem>
                  <SelectItem value="time_asc">タイム (速い順)</SelectItem>
                  <SelectItem value="time_desc">タイム (遅い順)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {periodFilter === "custom" && (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 border rounded"
                  placeholder="開始日"
                />
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 border rounded"
                  placeholder="終了日"
                />
              </div>
            )}
          </div>

          <div className="space-y-6">
            {Object.entries(groupedAndFilteredRecords).map(([key, records]) => {
              const [style, distance] = key.split('-');
              
              return (
                <Card key={key}>
                  <CardContent className="pt-6">
                    <div className="mb-4">
                      <h3 className="text-base sm:text-lg font-semibold">
                        {style} {distance}m
                      </h3>
                    </div>
                    
                    <ErrorBoundary
                      fallback={
                        <div className="w-full h-[200px] sm:h-[300px] lg:h-[400px] flex items-center justify-center text-destructive">
                          グラフの読み込み中にエラーが発生しました
                        </div>
                      }
                    >
                      <Suspense 
                        fallback={
                          <div className="w-full h-[200px] sm:h-[300px] lg:h-[400px] flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                              <p className="text-sm text-muted-foreground">グラフを読み込んでいます...</p>
                            </div>
                          </div>
                        }
                      >
                        <TimeProgressChart 
                          records={records} 
                          style={style} 
                          distance={parseInt(distance)}
                        />
                      </Suspense>
                    </ErrorBoundary>

                    <div className="space-y-3 mt-4">
                      {records.map((record) => {
                        const poolLengthKey = `${record.style}-${record.distance}-${record.poolLength}`;
                        const isBestTime = record.time === personalBests[poolLengthKey];
                        
                        return (
                          <div
                            key={record.id}
                            className="p-3 rounded-lg flex flex-col gap-2 md:flex-row md:justify-between md:items-center"
                          >
                            <div className="flex flex-col gap-2">
                              <span className="text-xl font-bold">{record.time}</span>
                              <div className="flex flex-wrap gap-2">
                                {isBestTime && (
                                  <Badge variant="secondary" className="flex items-center gap-1">
                                    <Trophy className="h-3 w-3" />
                                    自己ベスト ({record.poolLength}メートル)
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-start md:items-end gap-1">
                              <div className="text-sm text-muted-foreground">
                                {formatDate(record.date)}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {record.poolLength}メートル
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {isAdmin && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditingRecord(record)}
                                    disabled={isDeleting}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeletingRecord(record.id)}
                                    disabled={isDeleting}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog 
        open={!!deletingRecord} 
        onOpenChange={(open) => !open && setDeletingRecord(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>記録を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。本当にこの記録を削除してもよろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingRecord) {
                  handleDelete(deletingRecord);
                }
              }}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? "削除中..." : "削除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editingRecord && (
        <EditRecordForm
          record={editingRecord}
          isOpen={!!editingRecord}
          onClose={() => setEditingRecord(null)}
          onSubmit={async (values) => {
            try {
              const response = await fetch(`/api/records/${editingRecord.id}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  ...values,
                }),
                credentials: 'include',
              });

              if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || '記録の更新に失敗しました');
              }

              toast({
                title: "更新成功",
                description: "記録が更新されました",
              });

              setEditingRecord(null);
              
              if (onRecordDeleted) {
                onRecordDeleted();
              }
            } catch (error) {
              console.error('Error updating record:', error);
              toast({
                variant: "destructive",
                title: "エラー",
                description: error instanceof Error ? error.message : "記録の更新に失敗しました",
              });
              throw error;
            }
          }}
        />
      )}
    </>
  );
}

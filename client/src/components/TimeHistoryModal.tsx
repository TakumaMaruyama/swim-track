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
import { Trophy, TrendingUp, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "../hooks/use-user";
import type { ExtendedSwimRecord } from "../hooks/use-swim-records";
import { TimeProgressChart } from './TimeProgressChart';
import useSWR from "swr";
import type { Competition } from "db/schema";

type TimeHistoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  records: ExtendedSwimRecord[];
  athleteName: string;
  onRecordDeleted?: () => void;
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
  onRecordDeleted 
}: TimeHistoryModalProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const [styleFilter, setStyleFilter] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState<string>("date_desc");
  const [deletingRecord, setDeletingRecord] = React.useState<number | null>(null);
  const { data: competitions } = useSWR<Competition[]>("/api/competitions");

  const groupedAndFilteredRecords: GroupedRecords = React.useMemo(() => {
    const filtered = records.filter(record => 
      styleFilter === "all" || record.style === styleFilter
    );

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
  }, [records, styleFilter, sortBy]);

  const personalBests = React.useMemo(() => {
    const bests: { [key: string]: string } = {};
    Object.entries(groupedAndFilteredRecords).forEach(([key, records]) => {
      bests[key] = records.reduce((best, record) => 
        record.time < best ? record.time : best
      , records[0].time);
    });
    return bests;
  }, [groupedAndFilteredRecords]);

  const handleDelete = async (recordId: number) => {
    try {
      const response = await fetch(`/api/records/${recordId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete record');
      }

      toast({
        title: "削除成功",
        description: "記録が削除されました",
      });
      
      if (onRecordDeleted) {
        onRecordDeleted();
      }
    } catch (error) {
      console.error('Error deleting record:', error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "記録の削除に失敗しました",
      });
    } finally {
      setDeletingRecord(null);
    }
  };

  const getCompetitionName = (competitionId: number | null) => {
    if (!competitionId || !competitions) return null;
    const competition = competitions.find(c => c.id === competitionId);
    return competition ? competition.name : null;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{athleteName}の記録履歴</DialogTitle>
            <DialogDescription>
              選手の記録の推移と詳細を表示します
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-4 mb-4">
            <Select value={styleFilter} onValueChange={setStyleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="種目で絞り込み" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての種目</SelectItem>
                {swimStyles.map(style => (
                  <SelectItem key={style} value={style}>{style}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
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

          <div className="space-y-6">
            {Object.entries(groupedAndFilteredRecords).map(([key, records]) => {
              const [style, distance] = key.split('-');
              const poolLength = records[0]?.poolLength || 25;
              
              return (
                <Card key={key}>
                  <CardContent className="pt-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold">
                        {style} {distance}m ({poolLength}mプール)
                      </h3>
                    </div>
                    
                    <TimeProgressChart 
                      records={records} 
                      style={style} 
                      distance={parseInt(distance)}
                      poolLength={poolLength}
                    />

                    <div className="space-y-3 mt-4">
                      {records.map((record) => {
                        const competitionName = getCompetitionName(record.competitionId);
                        return (
                          <div
                            key={record.id}
                            className="p-3 rounded-lg flex flex-col gap-2 md:flex-row md:justify-between md:items-center"
                          >
                            <div className="flex flex-col gap-2">
                              <span className="text-xl font-bold">{record.time}</span>
                              <div className="flex flex-wrap gap-2">
                                {record.time === personalBests[key] && (
                                  <Badge variant="secondary" className="flex items-center gap-1">
                                    <Trophy className="h-3 w-3" />
                                    自己ベスト
                                  </Badge>
                                )}
                                {record.isCompetition && (
                                  <Badge className="flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3" />
                                    {competitionName || '大会記録'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-start md:items-end gap-1">
                              <div className="text-sm text-muted-foreground">
                                {formatDate(record.date)}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {record.poolLength}mプール
                              </div>
                            </div>
                            {user?.role === 'coach' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingRecord(record.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
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
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingRecord) {
                  handleDelete(deletingRecord);
                }
              }}
              className="bg-red-500 hover:bg-red-600"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

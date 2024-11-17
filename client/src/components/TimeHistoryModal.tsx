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
import { Trophy, TrendingUp, Trash2, Edit2, Medal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "../hooks/use-user";
import type { ExtendedSwimRecord } from "../hooks/use-swim-records";
import { TimeProgressChart } from './TimeProgressChart';
import { EditRecordForm } from './EditRecordForm';
import useSWR from "swr";
import type { Competition } from "db/schema";

type TimeHistoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  records: ExtendedSwimRecord[];
  athleteName: string;
  onRecordDeleted?: () => void;
  onRecordUpdated?: () => void;
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
  onRecordUpdated 
}: TimeHistoryModalProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const [styleFilter, setStyleFilter] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState<string>("date_desc");
  const [deletingRecord, setDeletingRecord] = React.useState<number | null>(null);
  const [editingRecord, setEditingRecord] = React.useState<number | null>(null);
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
      const key = `${record.style}-${record.distance}-${record.poolLength}`;
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

      toast({
        title: "更新成功",
        description: "記録が更新されました",
      });

      if (onRecordUpdated) {
        onRecordUpdated();
      }
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

  const getCompetitionName = (competitionId: number | null) => {
    if (!competitionId || !competitions) return null;
    const competition = competitions.find(c => c.id === competitionId);
    return competition ? competition.name : null;
  };

  const record = records.find(r => r.id === editingRecord);

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

          <div className="flex flex-col sm:flex-row gap-4 mb-4">
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

          <div className="space-y-6">
            {Object.entries(groupedAndFilteredRecords).map(([key, records]) => {
              const [style, distance, poolLength] = key.split('-');
              
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
                      poolLength={parseInt(poolLength)}
                    />

                    <div className="space-y-4 mt-6">
                      {records.map((record) => {
                        const competitionName = getCompetitionName(record.competitionId);
                        const isCompetitionRecord = record.isCompetition || competitionName;

                        return (
                          <div
                            key={record.id}
                            className={`p-4 rounded-lg ${isCompetitionRecord ? 'bg-primary/5 border border-primary/10' : 'bg-muted/50'} space-y-4`}
                          >
                            <div className="flex flex-col gap-4">
                              {competitionName && (
                                <div className="flex items-center gap-2">
                                  <Medal className="h-6 w-6 text-primary" />
                                  <h4 className="text-2xl font-bold text-primary tracking-tight">
                                    {competitionName}
                                  </h4>
                                </div>
                              )}
                              <div className="flex flex-col gap-2">
                                <div className="flex items-baseline gap-3">
                                  <span className="text-xl font-bold tracking-tight">{record.time}</span>
                                  {record.time === personalBests[key] && (
                                    <Badge variant="secondary" className="h-6">
                                      <Trophy className="h-4 w-4 mr-1" />
                                      自己ベスト
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {formatDate(record.date)}
                                </div>
                              </div>
                            </div>

                            {/* Actions Section */}
                            {user?.role === 'coach' && (
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditingRecord(record.id)}
                                  className="hover:bg-secondary"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeletingRecord(record.id)}
                                  className="hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
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

      <EditRecordForm
        record={record}
        isOpen={!!editingRecord}
        onClose={() => setEditingRecord(null)}
        onSubmit={async (data) => {
          if (record) {
            await handleEdit(record.id, data);
            setEditingRecord(null);
          }
        }}
      />
    </>
  );
}
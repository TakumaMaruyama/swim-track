import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp } from "lucide-react";
import type { ExtendedSwimRecord } from "../hooks/use-swim-records";

type TimeHistoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  records: ExtendedSwimRecord[];
  athleteName: string;
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

export function TimeHistoryModal({ isOpen, onClose, records, athleteName }: TimeHistoryModalProps) {
  const [styleFilter, setStyleFilter] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState<string>("date_desc");

  const groupedAndFilteredRecords: GroupedRecords = React.useMemo(() => {
    const filtered = records.filter(record => 
      styleFilter === "all" || record.style === styleFilter
    );

    // Sort records based on selected criteria
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "date_asc":
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case "date_desc":
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case "time_asc":
          return a.time.localeCompare(b.time);
        case "time_desc":
          return b.time.localeCompare(a.time);
        default:
          return 0;
      }
    });

    // Group by style and distance
    return sorted.reduce((acc, record) => {
      const key = `${record.style}-${record.distance}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(record);
      return acc;
    }, {} as GroupedRecords);
  }, [records, styleFilter, sortBy]);

  // Find personal bests for each style-distance combination
  const personalBests = React.useMemo(() => {
    const bests: { [key: string]: string } = {};
    Object.entries(groupedAndFilteredRecords).forEach(([key, records]) => {
      bests[key] = records.reduce((best, record) => 
        record.time < best ? record.time : best
      , records[0].time);
    });
    return bests;
  }, [groupedAndFilteredRecords]);

  return (
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
            return (
              <Card key={key}>
                <CardContent className="pt-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold">
                      {style} {distance}m
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {records.map((record) => (
                      <div
                        key={record.id}
                        className={`p-3 rounded-lg ${
                          record.time === personalBests[key]
                            ? 'bg-primary/10'
                            : 'bg-muted/50'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold">
                              {record.time}
                            </span>
                            {record.time === personalBests[key] && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <Trophy className="h-3 w-3" />
                                自己ベスト
                              </Badge>
                            )}
                            {record.isCompetition && (
                              <Badge className="flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" />
                                大会記録
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <div>{new Date(record.date).toLocaleDateString('ja-JP')}</div>
                            <div>{record.poolLength}mプール</div>
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
      </DialogContent>
    </Dialog>
  );
}

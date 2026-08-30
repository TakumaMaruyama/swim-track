import React from "react";
import useSWR from "swr";
import { ChevronDown, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";

type ImprovementItem = {
  eventLabel: string;
  startBestTime: string;
  currentBestTime: string;
  improvementMs: number;
  improvementRate: number;
  status: "improved" | "flat" | "regressed";
};

type ImprovementSummaryResponse = {
  athleteId: number;
  months: number;
  items: ImprovementItem[];
};

type TimeImprovementSummaryProps = {
  athleteId: number | null;
  isActive: boolean;
};

const PERIOD_OPTIONS = [
  { value: "1", label: "1か月" },
  { value: "3", label: "3か月" },
  { value: "6", label: "6か月" },
] as const;

function formatChange(item: ImprovementItem) {
  if (item.status === "flat") {
    return "変化なし（0.0%）";
  }

  const seconds = (Math.abs(item.improvementMs) / 1000).toFixed(2);
  const rate = Math.abs(item.improvementRate).toFixed(1);
  return item.status === "improved"
    ? `${seconds}秒短縮（${rate}%）`
    : `${seconds}秒遅くなった（${rate}%）`;
}

export function TimeImprovementSummary({ athleteId, isActive }: TimeImprovementSummaryProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [months, setMonths] = React.useState("6");

  React.useEffect(() => {
    setIsExpanded(false);
    setMonths("6");
  }, [athleteId, isActive]);

  const { data, error, isLoading } = useSWR<ImprovementSummaryResponse>(
    athleteId && isActive && isExpanded
      ? `/api/athletes/${athleteId}/improvement-summary?months=${months}`
      : null,
  );

  return (
    <section className="mb-4 overflow-hidden rounded-lg border border-blue-200 bg-blue-50/70">
      <Button
        type="button"
        variant="ghost"
        className="h-auto w-full justify-between rounded-none px-4 py-3 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span className="flex items-center gap-2 font-medium">
          <TrendingUp className="h-4 w-4" />
          {isExpanded ? "タイムの変化を閉じる" : "タイムの変化を見る"}
        </span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </Button>

      {isExpanded && (
        <div className="space-y-3 border-t border-blue-200 bg-background/90 px-4 pb-4 pt-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium">自己ベストの変化</p>
              <p className="text-xs text-muted-foreground">
                選んだ期間より前の自己ベストと、現在までの自己ベストを比べています。
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span className="whitespace-nowrap text-muted-foreground">比較期間</span>
              <select
                aria-label="比較期間"
                value={months}
                onChange={(event) => setMonths(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">読み込み中...</p>}
          {error && <p className="text-sm text-destructive">タイムの変化を読み込めませんでした。</p>}
          {!isLoading && !error && data?.items.length === 0 && (
            <p className="text-sm text-muted-foreground">この期間で比較できる記録はありません。</p>
          )}
          {!isLoading && !error && data?.items.map((item) => (
            <div
              key={item.eventLabel}
              className="grid gap-1 rounded-md bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4"
            >
              <p className="font-medium">{item.eventLabel}</p>
              <p className="text-sm tabular-nums text-muted-foreground">
                {item.startBestTime} → {item.currentBestTime}
              </p>
              <p
                className={
                  item.status === "improved"
                    ? "text-sm font-medium text-green-700"
                    : item.status === "regressed"
                      ? "text-sm font-medium text-red-700"
                      : "text-sm font-medium text-muted-foreground"
                }
              >
                {formatChange(item)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

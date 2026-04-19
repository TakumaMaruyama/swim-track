import React from "react";
import useSWR from "swr";
import { AlertCircle, ChevronDown, Flag, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type QualificationLevel = "national" | "kyushu" | "kagoshima";
type QualificationCourse = "SCM" | "LCM" | "ANY";
type QualificationEventStatus =
  | "qualified"
  | "gap"
  | "age_missing"
  | "source_unavailable"
  | "standard_missing"
  | "no_official_record";

type QualificationProgressEvent = {
  eventCode: string;
  eventLabel: string;
  style: string;
  distance: number;
  selectedPoolLength: number | null;
  currentBestTime: string | null;
  currentBestDate: string | null;
  standardTime: string | null;
  gapMs: number | null;
  status: QualificationEventStatus;
};

type AthleteQualificationSummary = {
  athleteId: number;
  athleteName: string;
  nameKana: string | null;
  isActive: boolean;
  totalEventCount: number;
  qualifiedEventCount: number;
  summaryStatus: QualificationEventStatus;
  closestEvent: QualificationProgressEvent | null;
  events: QualificationProgressEvent[];
};

type QualificationProgressCompetition = {
  competitionId: number;
  competitionName: string;
  competitionLocation: string;
  competitionDate: string | null;
  daysUntil: number | null;
  qualifyingMeetId: string | null;
  qualifyingLevel: QualificationLevel | null;
  qualifyingSeason: number | null;
  qualifyingCourse: QualificationCourse | null;
  athletes: AthleteQualificationSummary[];
};

type QualificationProgressResponse = {
  targetCompetitions: QualificationProgressCompetition[];
};

const LEVEL_LABELS: Record<QualificationLevel, string> = {
  national: "全国",
  kyushu: "九州",
  kagoshima: "鹿児島県",
};

const COURSE_LABELS: Record<QualificationCourse, string> = {
  SCM: "短水路",
  LCM: "長水路",
  ANY: "両対応",
};

const STATUS_LABELS: Record<QualificationEventStatus, string> = {
  qualified: "突破済み",
  gap: "未突破",
  age_missing: "生年月日未設定",
  source_unavailable: "標準取得不可",
  standard_missing: "標準未登録",
  no_official_record: "公式記録なし",
};

const STATUS_BADGE_CLASS: Record<QualificationEventStatus, string> = {
  qualified: "bg-green-100 text-green-800 hover:bg-green-100",
  gap: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  age_missing: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  source_unavailable: "bg-red-100 text-red-800 hover:bg-red-100",
  standard_missing: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  no_official_record: "bg-slate-100 text-slate-700 hover:bg-slate-100",
};

function formatDaysUntil(daysUntil: number | null) {
  if (daysUntil === null) {
    return "日程未設定";
  }

  if (daysUntil > 0) {
    return `あと${daysUntil}日`;
  }

  if (daysUntil === 0) {
    return "本日";
  }

  return `${Math.abs(daysUntil)}日前`;
}

function formatGap(
  event: QualificationProgressEvent | null,
  summaryStatus: QualificationEventStatus,
) {
  if (!event) {
    return STATUS_LABELS[summaryStatus];
  }

  if (event.status === "qualified") {
    return "突破済み";
  }

  if (event.status === "gap" && event.gapMs !== null) {
    return `あと${(event.gapMs / 1000).toFixed(2)}秒`;
  }

  return STATUS_LABELS[event.status];
}

function formatEventGap(event: QualificationProgressEvent) {
  if (event.status === "qualified") {
    return "突破済み";
  }

  if (event.status === "gap" && event.gapMs !== null) {
    return `あと${(event.gapMs / 1000).toFixed(2)}秒`;
  }

  return STATUS_LABELS[event.status];
}

export default function QualificationProgressPage() {
  const [expandedRows, setExpandedRows] = React.useState<Record<string, boolean>>({});
  const { data, error, isLoading, mutate } = useSWR<QualificationProgressResponse>(
    "/api/qualification-progress",
  );

  const toggleExpanded = (competitionId: number, athleteId: number) => {
    const key = `${competitionId}:${athleteId}`;
    setExpandedRows((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  return (
    <>
      <PageHeader title="大会目標一覧">
        <Button variant="outline" onClick={() => mutate()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          再読み込み
        </Button>
      </PageHeader>
      <div className="container space-y-6 pb-8">
        <Card className="border-blue-200 bg-blue-50/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Flag className="h-5 w-5" />
              標準タイムとの距離を一覧で確認
            </CardTitle>
            <CardDescription className="text-blue-900/80">
              管理者が大会情報で連携対象にした大会を、開催日順にまとめて表示します。
            </CardDescription>
          </CardHeader>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              大会目標一覧の読み込みに失敗しました。標準タイム API の接続先や大会設定を確認してください。
            </AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {!isLoading && !error && (data?.targetCompetitions?.length ?? 0) === 0 && (
          <Alert>
            <AlertDescription>
              表示対象の大会がまだありません。大会情報ページで「標準タイム連携」を有効にすると、ここに大会が並びます。
            </AlertDescription>
          </Alert>
        )}

        {data?.targetCompetitions.map((competition) => (
          <Card key={competition.competitionId} className="overflow-hidden">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <CardTitle>{competition.competitionName}</CardTitle>
                  <CardDescription>
                    {competition.competitionLocation}
                    {competition.competitionDate ? ` / ${competition.competitionDate}` : ""}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{formatDaysUntil(competition.daysUntil)}</Badge>
                  {competition.qualifyingLevel && (
                    <Badge variant="outline">{LEVEL_LABELS[competition.qualifyingLevel]}</Badge>
                  )}
                  {competition.qualifyingCourse && (
                    <Badge variant="outline">{COURSE_LABELS[competition.qualifyingCourse]}</Badge>
                  )}
                  {competition.qualifyingSeason && (
                    <Badge variant="outline">{competition.qualifyingSeason}シーズン</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>選手名</TableHead>
                    <TableHead>最も近い種目</TableHead>
                    <TableHead>あと何秒</TableHead>
                    <TableHead>突破数</TableHead>
                    <TableHead>残り日数</TableHead>
                    <TableHead className="w-[140px] text-right">詳細</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {competition.athletes.map((athlete) => {
                    const rowKey = `${competition.competitionId}:${athlete.athleteId}`;
                    const isExpanded = expandedRows[rowKey] ?? false;

                    return (
                      <React.Fragment key={rowKey}>
                        <TableRow>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{athlete.athleteName}</div>
                              {athlete.nameKana && (
                                <div className="text-xs text-muted-foreground">{athlete.nameKana}</div>
                              )}
                              {!athlete.isActive && (
                                <Badge variant="secondary">休会中</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div>{athlete.closestEvent?.eventLabel ?? athlete.events[0]?.eventLabel ?? "対象種目なし"}</div>
                              <Badge className={STATUS_BADGE_CLASS[athlete.summaryStatus]}>
                                {STATUS_LABELS[athlete.summaryStatus]}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatGap(athlete.closestEvent ?? null, athlete.summaryStatus)}
                          </TableCell>
                          <TableCell>
                            {athlete.qualifiedEventCount}/{athlete.totalEventCount}
                          </TableCell>
                          <TableCell>{formatDaysUntil(competition.daysUntil)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpanded(competition.competitionId, athlete.athleteId)}
                            >
                              詳細表示
                              <ChevronDown
                                className={`ml-2 h-4 w-4 transition-transform ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              />
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={6} className="bg-muted/20">
                              {athlete.events.length === 0 ? (
                                <div className="py-3 text-sm text-muted-foreground">
                                  公式距離の記録がまだありません。
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="text-sm font-medium">全種目の進捗</div>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>種目</TableHead>
                                        <TableHead>現在ベスト</TableHead>
                                        <TableHead>標準</TableHead>
                                        <TableHead>差</TableHead>
                                        <TableHead>状態</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {athlete.events.map((event) => (
                                        <TableRow key={`${rowKey}:${event.eventCode}`}>
                                          <TableCell>
                                            <div className="space-y-1">
                                              <div>{event.eventLabel}</div>
                                              {event.currentBestDate && (
                                                <div className="text-xs text-muted-foreground">
                                                  {event.currentBestDate}
                                                </div>
                                              )}
                                            </div>
                                          </TableCell>
                                          <TableCell>{event.currentBestTime ?? "-"}</TableCell>
                                          <TableCell>{event.standardTime ?? "-"}</TableCell>
                                          <TableCell>{formatEventGap(event)}</TableCell>
                                          <TableCell>
                                            <Badge className={STATUS_BADGE_CLASS[event.status]}>
                                              {STATUS_LABELS[event.status]}
                                            </Badge>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

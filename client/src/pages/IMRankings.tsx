import React from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Medal, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useSwimRecords } from '@/hooks/use-swim-records';
import {
  getLatestEvenMonth,
  calculateIMRankings,
  type IMRankingsData,
  type RankingRecord,
} from '@/lib/rankingCalculations';
import { generateRankingsPDF, pdfDateStamp } from '@/lib/pdfGenerator';

// タイムをフォーマット
function formatTime(time: string): string {
  const [minutes, seconds] = time.split(':');
  if (!seconds) return time;
  return `${minutes}'${seconds}"`;
}

export default function IMRankings() {
  const [, navigate] = useLocation();
  const { records, isLoading, error } = useSwimRecords();

  const { year, month } = getLatestEvenMonth();
  const targetMonthName = `${year}年${month}月`;
  const [isGeneratingPDF, setIsGeneratingPDF] = React.useState(false);
  const isGeneratingPDFRef = React.useRef(false);

  // IM測定記録を抽出してランキングを作成
  const rankings = React.useMemo(() => {
    if (!records) return null;
    return calculateIMRankings(records, year, month);
  }, [records, year, month]);

  // PDF出力ハンドラ
  const handleDownloadPDF = async () => {
    if (!rankings) {
      alert('データが不足しているため、PDFを生成できません');
      return;
    }
    if (isGeneratingPDFRef.current) return;

    isGeneratingPDFRef.current = true;
    setIsGeneratingPDF(true);
    try {
      await generateRankingsPDF(
        { kind: 'measurement', rankings, monthLabel: targetMonthName },
        `IM測定ランキング_${targetMonthName}_${pdfDateStamp()}.pdf`,
      );
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('PDFの生成中にエラーが発生しました。もう一度お試しください。');
    } finally {
      isGeneratingPDFRef.current = false;
      setIsGeneratingPDF(false);
    }
  };

  const hasRankings = (data: IMRankingsData | null) =>
    !!data && Object.values(data).some((distance) =>
      Object.values(distance).some((group) => group.length > 0),
    );
  const canDownloadPDF = hasRankings(rankings);

  const RankingTable: React.FC<{
    title: string;
    rankings: RankingRecord[];
  }> = ({ title, rankings }) => {
    const getMedalColor = (rank: number) => {
      switch (rank) {
        case 1: return 'text-yellow-500';
        case 2: return 'text-gray-400';
        case 3: return 'text-orange-600';
        default: return 'text-gray-500';
      }
    };

    return (
      <div className="space-y-3">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          {title === '男子' ? '🏊‍♂️' : '🏊‍♀️'} {title}
        </h3>
        {rankings.length === 0 ? (
          <p className="text-sm text-muted-foreground">記録がありません</p>
        ) : (
          <div className="space-y-2">
            {rankings.map((record) => (
              <div
                key={record.rank}
                className="flex items-center gap-6 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Medal className={`h-5 w-5 ${getMedalColor(record.rank)}`} />
                  <div className="min-w-0">
                    <p className="font-medium min-w-0 break-words">{record.athleteName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(record.date).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                </div>
                <p className="text-lg font-bold text-primary shrink-0">
                  {formatTime(record.time)}
                </p>
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
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-600">
                IM測定ランキング
              </h1>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
                {targetMonthName}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                2か月ごとの測定で、各性別の上位3名を表示しています
              </p>
            </div>
            <Button
              onClick={handleDownloadPDF}
              className="shrink-0 hidden sm:flex"
              disabled={!canDownloadPDF || isGeneratingPDF}
            >
              <Download className="h-4 w-4 mr-2" />
              {isGeneratingPDF ? 'PDF作成中...' : 'PDF出力'}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 pb-28 px-4 sm:px-6 lg:px-8">
        <div id="im-rankings-content" className="space-y-6">
          {/* PDFタイトル */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">IM測定ランキング</h2>
            <p className="text-sm text-muted-foreground">{targetMonthName}測定</p>
          </div>
          {/* 60m 個人メドレー */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">
                60m 個人メドレー
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              {rankings && (
                <>
                  <RankingTable title="男子" rankings={rankings['60m'].male} />
                  <RankingTable title="女子" rankings={rankings['60m'].female} />
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
              {rankings && (
                <>
                  <RankingTable title="男子" rankings={rankings['120m'].male} />
                  <RankingTable title="女子" rankings={rankings['120m'].female} />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      
      {/* モバイル用の固定ボタン */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg z-10">
        <Button
          onClick={handleDownloadPDF}
          className="w-full"
          disabled={!canDownloadPDF || isGeneratingPDF}
        >
          <Download className="h-4 w-4 mr-2" />
          {isGeneratingPDF ? 'PDF作成中...' : 'PDF出力'}
        </Button>
      </div>
    </div>
  );
}

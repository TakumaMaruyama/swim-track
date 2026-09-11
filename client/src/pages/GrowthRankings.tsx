import React from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, TrendingUp, ArrowDown, ArrowUp, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useSwimRecords } from '@/hooks/use-swim-records';
import {
  calculateGrowthRankings,
  type GrowthRankingsData,
  type GrowthRecord,
} from '@/lib/rankingCalculations';
import { generateRankingsPDF, pdfDateStamp } from '@/lib/pdfGenerator';

// タイムをフォーマット
function formatTime(time: string): string {
  const [minutes, seconds] = time.split(':');
  if (!seconds) return time;
  return `${minutes}'${seconds}"`;
}

export default function GrowthRankings() {
  const [, navigate] = useLocation();
  const { records, isLoading, error } = useSwimRecords();
  const [isGeneratingPDF, setIsGeneratingPDF] = React.useState(false);
  const isGeneratingPDFRef = React.useRef(false);

  // 伸び率ランキングを計算
  const growthRankings = React.useMemo(() => {
    if (!records) return null;
    return calculateGrowthRankings(records);
  }, [records]);

  // PDF出力ハンドラ
  const handleDownloadPDF = async () => {
    if (!growthRankings?.rankings) {
      alert('データが不足しているため、PDFを生成できません');
      return;
    }
    if (isGeneratingPDFRef.current) return;

    const growthMonth = `${growthRankings.periods.current.year}年${growthRankings.periods.current.month}月`;
    isGeneratingPDFRef.current = true;
    setIsGeneratingPDF(true);
    try {
      await generateRankingsPDF(
        { kind: 'growth', rankings: growthRankings, monthLabel: growthMonth },
        `IM伸び率ランキング_${growthMonth}_${pdfDateStamp()}.pdf`,
      );
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('PDFの生成中にエラーが発生しました。もう一度お試しください。');
    } finally {
      isGeneratingPDFRef.current = false;
      setIsGeneratingPDF(false);
    }
  };

  const hasRankings = (data: GrowthRankingsData | null) =>
    !!data && Object.values(data.rankings).some((distance) =>
      Object.values(distance).some((group) => group.length > 0),
    );

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
          <p className="text-sm text-muted-foreground">最新月の記録がある選手がいません</p>
        ) : (
          <div className="space-y-2">
            {rankings.map((record) => (
              <div
                key={record.studentId}
                className="flex w-full items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                    {record.rank}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words">{record.athleteName}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground mt-1">
                      <span className="shrink-0 break-words">自己ベスト: {formatTime(record.bestTime)}</span>
                      <span className="shrink-0">→</span>
                      <span className="shrink-0 break-words">今回: {formatTime(record.currentTime)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right ml-auto shrink-0">
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
                  IM伸び率ランキング
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
                伸び率を表示するには偶数月の記録が必要です
              </p>
              <p className="text-sm text-muted-foreground">
                個人メドレー（15mプール）の記録を登録してください
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const { current: currentPeriod } = growthRankings.periods;
  const currentMonthName = `${currentPeriod.year}年${currentPeriod.month}月`;

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
              <h1 className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-600 flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-blue-600" />
                IM伸び率ランキング
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                自己ベスト→今回（{currentMonthName}）
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                自己ベストからどれだけ短縮したかを全員分表示しています<br />
                直近2か月のがんばりを見える化し、今後の指導にも活用します
              </p>
            </div>
            <Button
              onClick={handleDownloadPDF}
              className="shrink-0 hidden sm:flex"
              disabled={!hasRankings(growthRankings) || isGeneratingPDF}
            >
              <Download className="h-4 w-4 mr-2" />
              {isGeneratingPDF ? 'PDF作成中...' : 'PDF出力'}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 pb-28 px-4 sm:px-6 lg:px-8">
        <div id="growth-rankings-content" className="space-y-6">
          {/* PDFタイトル */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">IM伸び率ランキング</h2>
            <p className="text-sm text-muted-foreground">{currentMonthName}測定</p>
          </div>
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
      
      {/* モバイル用の固定ボタン */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg z-10">
        <Button
          onClick={handleDownloadPDF}
          className="w-full"
          disabled={!hasRankings(growthRankings) || isGeneratingPDF}
        >
          <Download className="h-4 w-4 mr-2" />
          {isGeneratingPDF ? 'PDF作成中...' : 'PDF出力'}
        </Button>
      </div>
    </div>
  );
}

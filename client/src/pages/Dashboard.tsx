import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingDown,
  Plus,
  Key,
  ClipboardList,
  LogOut
} from 'lucide-react';
import { useUser } from "../hooks/use-user";
import { useLocation } from "wouter";
import { UserPasswordList } from "@/components/UserPasswordList";
import { useSwimRecords, type ExtendedSwimRecord } from "../hooks/use-swim-records";
import { useCompetitions } from "../hooks/use-competitions";
import { EditCompetitionForm } from "@/components/EditCompetitionForm";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
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
import { Badge } from "@/components/ui/badge";

interface Improvement {
  athleteName: string;
  style: string;
  distance: number;
  poolLength: number;
  previousBest: string;
  newTime: string;
  improvement: string;
  date: Date;
}

const convertTimeToSeconds = (time: string) => {
  const [minutes, seconds] = time.split(':').map(Number);
  return minutes * 60 + seconds;
};

const formatTimeImprovement = (seconds: number) => {
  const minutes = Math.floor(Math.abs(seconds) / 60);
  const remainingSeconds = (Math.abs(seconds) % 60).toFixed(2);
  return `${minutes}:${remainingSeconds.padStart(5, '0')}`;
};

const calculateImprovements = (records: ExtendedSwimRecord[] | undefined, monthOffset: number = 0): Improvement[] => {
  if (!records?.length) return [];

  const now = new Date();
  const targetMonth = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
  const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
  const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59, 999);

  // Group records by athlete and event type
  const recordsByAthlete = records.reduce((acc, record) => {
    if (!record.date || !record.athleteName) return acc;
    
    const key = `${record.studentId}-${record.style}-${record.distance}-${record.poolLength}`;
    if (!acc[key]) {
      acc[key] = {
        records: [],
        athleteName: record.athleteName,
        style: record.style,
        distance: record.distance,
        poolLength: record.poolLength
      };
    }
    acc[key].records.push(record);
    return acc;
  }, {} as { [key: string]: { 
    records: ExtendedSwimRecord[], 
    athleteName: string,
    style: string,
    distance: number,
    poolLength: number
  }});

  const improvements: Improvement[] = [];

  // Process each athlete's records
  Object.values(recordsByAthlete).forEach(({ records: athleteRecords, athleteName, style, distance, poolLength }) => {
    // Get records from the target month
    const monthRecords = athleteRecords.filter(record => {
      const recordDate = new Date(record.date!);
      return recordDate >= monthStart && recordDate <= monthEnd;
    });

    // Sort all records chronologically
    const sortedRecords = [...athleteRecords].sort((a, b) => 
      new Date(a.date!).getTime() - new Date(b.date!).getTime()
    );

    // Process each record from the target month
    monthRecords.forEach(currentRecord => {
      // Find all previous records (before this record)
      const previousRecords = sortedRecords.filter(r => 
        new Date(r.date!) < new Date(currentRecord.date!)
      );

      if (previousRecords.length > 0) {
        // Find personal best among previous records
        const previousBest = previousRecords.reduce((best, record) => {
          const bestTime = convertTimeToSeconds(best.time);
          const recordTime = convertTimeToSeconds(record.time);
          return recordTime < bestTime ? record : best;
        });

        const currentTime = convertTimeToSeconds(currentRecord.time);
        const bestTime = convertTimeToSeconds(previousBest.time);

        // Only count as improvement if current time beats previous best
        if (currentTime < bestTime) {
          improvements.push({
            athleteName,
            style,
            distance,
            poolLength,
            previousBest: previousBest.time,
            newTime: currentRecord.time,
            improvement: formatTimeImprovement(bestTime - currentTime),
            date: new Date(currentRecord.date!)
          });
        }
      }
    });
  });

  // Sort improvements by date (most recent first)
  return improvements.sort((a, b) => b.date.getTime() - a.date.getTime());
};

export default function Dashboard() {
  const { user, logout } = useUser();
  const [, navigate] = useLocation();
  const { records } = useSwimRecords();
  const { competitions, mutate: mutateCompetitions } = useCompetitions();
  const { toast } = useToast();
  const [showUserPasswordList, setShowUserPasswordList] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState<number>(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Calculate improvements for current and last month
  const currentMonthImprovements = calculateImprovements(records, 0);
  const lastMonthImprovements = calculateImprovements(records, 1);

  const handleLogout = async () => {
    const result = await logout();
    if (result.ok) {
      toast({
        title: "ログアウト成功",
        description: "ログアウトしました",
      });
      navigate("/login");
    } else {
      toast({
        variant: "destructive",
        title: "エラー",
        description: result.message,
      });
    }
  };

  const handleCreateCompetition = async (data: { name: string; date: string; location: string }) => {
    try {
      const response = await fetch("/api/competitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) throw new Error();

      await mutateCompetitions();
      setEditingCompetition(0);
      toast({
        title: "作成成功",
        description: "大会が作成されました",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "大会の作成に失敗しました",
      });
    }
  };

  const handleUpdateCompetition = async (
    competitionId: number,
    data: { name: string; date: string; location: string }
  ) => {
    try {
      const response = await fetch(`/api/competitions/${competitionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) throw new Error();

      await mutateCompetitions();
      setEditingCompetition(0);
      toast({
        title: "更新成功",
        description: "大会が更新されました",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "大会の更新に失敗しました",
      });
    }
  };

  const handleDeleteCompetition = async (competitionId: number) => {
    try {
      const response = await fetch(`/api/competitions/${competitionId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) throw new Error();

      await mutateCompetitions();
      toast({
        title: "削除成功",
        description: "大会が削除されました",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "大会の削除に失敗しました",
      });
    }
  };

  if (!user) return null;

  const upcomingCompetitions = competitions
    ?.filter(comp => new Date(comp.date) > new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) ?? [];

  const nextCompetition = upcomingCompetitions[0];
  const timeUntilCompetition = nextCompetition
    ? Math.max(0, Math.floor((new Date(nextCompetition.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const competition = competitions?.find(c => c.id === editingCompetition);

  return (
    <>
      <div className="container px-4 py-4 md:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">SwimTrack</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground mr-2">
              {user.username} ({user.role === "coach" ? "コーチ" : "選手"})
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLogoutConfirm(true)}
            >
              <LogOut className="h-4 w-4 mr-2" />
              ログアウト
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {user.role === "coach" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    大会管理
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    className="w-full mb-2"
                    onClick={() => setEditingCompetition(-1)}
                  >
                    新規大会作成
                  </Button>
                  {upcomingCompetitions.map((comp) => (
                    <div
                      key={comp.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 mb-2"
                    >
                      <div>
                        <div className="font-medium">{comp.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(comp.date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingCompetition(comp.id)}
                        >
                          編集
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCompetition(comp.id)}
                        >
                          削除
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    パスワード管理
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowUserPasswordList(true)}
                  >
                    パスワード一覧
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                次の大会まで
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                {nextCompetition ? (
                  <>
                    <p className="text-3xl font-bold text-primary mb-2">
                      {timeUntilCompetition}日
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {nextCompetition.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(nextCompetition.date).toLocaleDateString()}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">予定された大会はありません</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                自己ベスト更新
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Current Month Improvements */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">今月の更新</h3>
                  <div className="space-y-2">
                    {currentMonthImprovements.length > 0 ? (
                      currentMonthImprovements.map((imp, index) => (
                        <div
                          key={index}
                          className="p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{imp.athleteName}</span>
                                <Badge variant="outline">
                                  {imp.style} {imp.distance}m
                                </Badge>
                                <Badge variant="secondary">
                                  {imp.poolLength}mプール
                                </Badge>
                              </div>
                              <div className="text-sm mt-1">
                                <span className="text-muted-foreground">
                                  {imp.previousBest}
                                </span>
                                {" → "}
                                <span className="font-medium">{imp.newTime}</span>
                                <span className="text-green-600 ml-2">
                                  (-{imp.improvement})
                                </span>
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground text-right">
                              {new Date(imp.date).toLocaleDateString('ja-JP')}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-muted-foreground">
                        更新はありません
                      </div>
                    )}
                  </div>
                </div>

                {/* Last Month Improvements */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">先月の更新</h3>
                  <div className="space-y-2">
                    {lastMonthImprovements.length > 0 ? (
                      lastMonthImprovements.map((imp, index) => (
                        <div
                          key={index}
                          className="p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{imp.athleteName}</span>
                                <Badge variant="outline">
                                  {imp.style} {imp.distance}m
                                </Badge>
                                <Badge variant="secondary">
                                  {imp.poolLength}mプール
                                </Badge>
                              </div>
                              <div className="text-sm mt-1">
                                <span className="text-muted-foreground">
                                  {imp.previousBest}
                                </span>
                                {" → "}
                                <span className="font-medium">{imp.newTime}</span>
                                <span className="text-green-600 ml-2">
                                  (-{imp.improvement})
                                </span>
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground text-right">
                              {new Date(imp.date).toLocaleDateString('ja-JP')}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-muted-foreground">
                        更新はありません
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {competition && (
            <EditCompetitionForm
              competition={competition}
              onSubmit={handleUpdateCompetition}
              onCancel={() => setEditingCompetition(0)}
              onDelete={handleDeleteCompetition}
            />
          )}

          {editingCompetition === -1 && (
            <EditCompetitionForm
              onSubmit={handleCreateCompetition}
              onCancel={() => setEditingCompetition(0)}
            />
          )}

          <UserPasswordList
            isOpen={showUserPasswordList}
            onClose={() => setShowUserPasswordList(false)}
          />

          <AlertDialog 
            open={showLogoutConfirm} 
            onOpenChange={setShowLogoutConfirm}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>ログアウトしますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  ログアウトするとセッションが終了します
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction onClick={handleLogout}>
                  ログアウト
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </>
  );
}
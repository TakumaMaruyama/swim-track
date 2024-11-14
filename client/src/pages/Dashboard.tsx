import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingDown,
  Plus,
  UserX,
  Key,
  ClipboardList,
  LogOut
} from 'lucide-react';
import { useUser } from "../hooks/use-user";
import { useLocation } from "wouter";
import { StudentPasswordList } from "@/components/StudentPasswordList";
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

const calculateImprovements = (records: ExtendedSwimRecord[] | undefined, targetYear: number = 2024, targetMonth: number = 9): Improvement[] => {
  if (!records?.length) return [];

  const monthStart = new Date(targetYear, targetMonth, 1);
  const monthEnd = new Date(targetYear, targetMonth + 1, 0);

  console.log('Date range:', {
    start: monthStart.toISOString(),
    end: monthEnd.toISOString()
  });

  // Group records by athlete and event type
  const athleteRecords = records.reduce((acc, record) => {
    if (!record.date || !record.athleteName) return acc;
    
    const key = `${record.studentId}-${record.style}-${record.distance}-${record.poolLength}`;
    if (!acc[key]) {
      acc[key] = {
        records: [],
        athleteName: record.athleteName
      };
    }
    acc[key].records.push(record);
    return acc;
  }, {} as { [key: string]: { records: ExtendedSwimRecord[], athleteName: string } });

  const improvements: Improvement[] = [];

  Object.entries(athleteRecords).forEach(([key, { records: athleteRecords, athleteName }]) => {
    // Sort records by date
    const sortedRecords = [...athleteRecords].sort((a, b) => 
      new Date(a.date!).getTime() - new Date(b.date!).getTime()
    );
    
    // Find records in target month
    const monthRecords = sortedRecords.filter(record => {
      const recordDate = new Date(record.date!);
      return recordDate >= monthStart && recordDate <= monthEnd;
    });

    console.log('Records found:', {
      total: sortedRecords.length,
      inMonth: monthRecords.length,
      forAthlete: athleteName
    });

    monthRecords.forEach(currentRecord => {
      // Find previous records (before this record)
      const previousRecords = sortedRecords.filter(r => 
        new Date(r.date!) < new Date(currentRecord.date!)
      );
      
      if (previousRecords.length > 0) {
        // Find previous best time
        const previousBest = previousRecords.reduce((best, record) => {
          const bestTime = convertTimeToSeconds(best.time);
          const recordTime = convertTimeToSeconds(record.time);
          return recordTime < bestTime ? record : best;
        }, previousRecords[0]);

        const currentTime = convertTimeToSeconds(currentRecord.time);
        const bestTime = convertTimeToSeconds(previousBest.time);

        // Only count as improvement if current time beats previous best
        if (currentTime < bestTime) {
          improvements.push({
            athleteName,
            style: currentRecord.style,
            distance: currentRecord.distance,
            poolLength: currentRecord.poolLength,
            previousBest: previousBest.time,
            newTime: currentRecord.time,
            improvement: (bestTime - currentTime).toFixed(2),
            date: new Date(currentRecord.date!)
          });
        }
      }
    });
  });

  // Sort improvements by amount (largest improvement first)
  return improvements.sort((a, b) => parseFloat(b.improvement) - parseFloat(a.improvement));
};

export default function Dashboard() {
  const { user, logout, isLoading: userLoading } = useUser();
  const [, navigate] = useLocation();
  const { records, isLoading: recordsLoading } = useSwimRecords();
  const { competitions, isLoading: competitionsLoading, mutate: mutateCompetitions } = useCompetitions();
  const { toast } = useToast();
  const [showPasswordList, setShowPasswordList] = useState(false);
  const [showUserPasswordList, setShowUserPasswordList] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState<number>(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Update improvement calculations to use fixed October 2024
  const currentMonthImprovements = calculateImprovements(records, 2024, 9); // October 2024
  const lastMonthImprovements = calculateImprovements(records, 2024, 8); // September 2024

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

  if (userLoading || recordsLoading || competitionsLoading) {
    return <div className="flex items-center justify-center min-h-screen">読み込み中...</div>;
  }

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
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-medium">{imp.athleteName}</div>
                              <div className="text-sm text-muted-foreground">
                                {imp.style} {imp.distance}m ({imp.poolLength}mプール)
                              </div>
                              <div className="text-sm">
                                {imp.previousBest} → {imp.newTime} ({imp.improvement}秒更新)
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(imp.date).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-muted-foreground">
                        今月の更新はありません
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
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-medium">{imp.athleteName}</div>
                              <div className="text-sm text-muted-foreground">
                                {imp.style} {imp.distance}m ({imp.poolLength}mプール)
                              </div>
                              <div className="text-sm">
                                {imp.previousBest} → {imp.newTime} ({imp.improvement}秒更新)
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(imp.date).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-muted-foreground">
                        先月の更新はありません
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <StudentPasswordList
        isOpen={showPasswordList}
        onClose={() => setShowPasswordList(false)}
      />

      <UserPasswordList
        isOpen={showUserPasswordList}
        onClose={() => setShowUserPasswordList(false)}
      />

      <EditCompetitionForm
        isOpen={editingCompetition !== 0}
        onClose={() => setEditingCompetition(0)}
        onSubmit={editingCompetition === -1 ? handleCreateCompetition : handleUpdateCompetition}
        competition={competition}
        competitionId={editingCompetition}
      />

      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ログアウトしますか？</AlertDialogTitle>
            <AlertDialogDescription>
              セッションを終了してログアウトします。
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
    </>
  );
}

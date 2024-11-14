import React, { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Users, 
  Trophy, 
  Calendar, 
  Timer, 
  ClipboardList,
  TrendingDown,
  LogOut,
  Plus,
  Edit2,
  Trash2,
  UserX,
  Key 
} from 'lucide-react'
import { useUser } from '../hooks/use-user'
import { useLocation } from 'wouter'
import { useMobile } from '../hooks/use-mobile'
import { MobileNav } from '../components/MobileNav'
import { useSwimRecords } from '../hooks/use-swim-records'
import { useCompetitions } from '../hooks/use-competitions'
import { PageHeader } from '../components/PageHeader'
import { EditCompetitionForm } from '../components/EditCompetitionForm'
import { useToast } from '@/hooks/use-toast';
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
import { UserPasswordList } from '../components/UserPasswordList';

const calculateTimeUntilCompetition = (competitionDate: Date) => {
  const now = new Date();
  const diffTime = competitionDate.getTime() - now.getTime();
  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return { days, hours };
};

// Helper function to convert MM:SS.ss to seconds
const convertTimeToSeconds = (time: string) => {
  const [minutes, seconds] = time.split(':').map(Number);
  return minutes * 60 + seconds;
};

const calculateTimeImprovement = (records: any[]) => {
  if (!records || records.length === 0) return {
    currentMonth: { totalImprovement: 0, improvementCount: 0 },
    lastMonth: { totalImprovement: 0, improvementCount: 0 }
  };

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  // Group records by student and event type
  const groupedRecords: { [key: string]: any[] } = {};
  records.forEach(record => {
    const key = `${record.studentId}-${record.style}-${record.distance}-${record.poolLength}`;
    if (!groupedRecords[key]) {
      groupedRecords[key] = [];
    }
    groupedRecords[key].push(record);
  });

  let currentMonthImprovement = 0;
  let currentMonthCount = 0;
  let lastMonthImprovement = 0;
  let lastMonthCount = 0;

  // Process each group (student-event combination)
  Object.values(groupedRecords).forEach(group => {
    // Sort records by date
    const sortedRecords = group.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // For each record, find the best previous time
    for (let i = 0; i < sortedRecords.length; i++) {
      const currentRecord = sortedRecords[i];
      const recordDate = new Date(currentRecord.date);
      const recordMonth = recordDate.getMonth();
      const recordYear = recordDate.getFullYear();

      if (recordMonth !== currentMonth || recordYear !== currentYear) continue;

      // Find best time before this record
      let previousBest = null;
      for (let j = 0; j < i; j++) {
        const prevRecord = sortedRecords[j];
        if (!previousBest || convertTimeToSeconds(prevRecord.time) < convertTimeToSeconds(previousBest.time)) {
          previousBest = prevRecord;
        }
      }

      if (previousBest) {
        const prevTimeInSeconds = convertTimeToSeconds(previousBest.time);
        const currentTimeInSeconds = convertTimeToSeconds(currentRecord.time);

        if (currentTimeInSeconds < prevTimeInSeconds) {
          // Record is an improvement over previous best
          const improvement = prevTimeInSeconds - currentTimeInSeconds;
          if (recordMonth === currentMonth && recordYear === currentYear) {
            currentMonthImprovement += improvement;
            currentMonthCount++;
          }
        }
      }
    }

    // Same process for last month
    for (let i = 0; i < sortedRecords.length; i++) {
      const currentRecord = sortedRecords[i];
      const recordDate = new Date(currentRecord.date);
      const recordMonth = recordDate.getMonth();
      const recordYear = recordDate.getFullYear();

      if (recordMonth !== lastMonth || recordYear !== lastMonthYear) continue;

      let previousBest = null;
      for (let j = 0; j < i; j++) {
        const prevRecord = sortedRecords[j];
        if (!previousBest || convertTimeToSeconds(prevRecord.time) < convertTimeToSeconds(previousBest.time)) {
          previousBest = prevRecord;
        }
      }

      if (previousBest) {
        const prevTimeInSeconds = convertTimeToSeconds(previousBest.time);
        const currentTimeInSeconds = convertTimeToSeconds(currentRecord.time);

        if (currentTimeInSeconds < prevTimeInSeconds) {
          const improvement = prevTimeInSeconds - currentTimeInSeconds;
          lastMonthImprovement += improvement;
          lastMonthCount++;
        }
      }
    }
  });

  return {
    currentMonth: {
      totalImprovement: parseFloat(currentMonthImprovement.toFixed(2)),
      improvementCount: currentMonthCount
    },
    lastMonth: {
      totalImprovement: parseFloat(lastMonthImprovement.toFixed(2)),
      improvementCount: lastMonthCount
    }
  };
};

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user, isLoading, logout, deleteAccount } = useUser();
  const isMobile = useMobile();
  const { toast } = useToast();
  const { records, isLoading: recordsLoading } = useSwimRecords(true);
  const { competitions, isLoading: competitionsLoading, mutate: mutateCompetitions } = useCompetitions();
  const [editingCompetition, setEditingCompetition] = React.useState<number | null>(null);
  const [showLogoutDialog, setShowLogoutDialog] = React.useState(false);
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = React.useState(false);
  const [showPasswordList, setShowPasswordList] = React.useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  const handleLogout = async () => {
    const result = await logout();
    if (result.ok) {
      toast({
        title: "ログアウト成功",
        description: "セッションが終了しました",
      });
      navigate('/login');
    } else {
      toast({
        variant: "destructive",
        title: "エラー",
        description: result.message || "ログアウトに失敗しました",
      });
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const result = await deleteAccount();
      if (result.ok) {
        toast({
          title: "アカウント削除成功",
          description: "アカウントが削除されました",
        });
        navigate('/login');
      } else {
        toast({
          variant: "destructive",
          title: "エラー",
          description: result.message || "アカウントの削除に失敗しました",
        });
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "予期せぬエラーが発生しました",
      });
    }
  };

  const handleCreateCompetition = async (data: any) => {
    try {
      const response = await fetch('/api/competitions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to create competition');
      }

      await mutateCompetitions();
      setEditingCompetition(null);
    } catch (error) {
      console.error('Error creating competition:', error);
      throw error;
    }
  };

  const handleEditCompetition = async (competitionId: number, data: any) => {
    try {
      const response = await fetch(`/api/competitions/${competitionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to update competition');
      }

      await mutateCompetitions();
      setEditingCompetition(null);
    } catch (error) {
      console.error('Error updating competition:', error);
      throw error;
    }
  };

  const handleDeleteCompetition = async (competitionId: number) => {
    if (!confirm('この大会を削除してもよろしいですか？')) {
      return;
    }

    try {
      const response = await fetch(`/api/competitions/${competitionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete competition');
      }

      await mutateCompetitions();
      toast({
        title: "削除成功",
        description: "大会が削除されました",
      });
    } catch (error) {
      console.error('Error deleting competition:', error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "大会の削除に失敗しました",
      });
    }
  };

  if (isLoading || recordsLoading || competitionsLoading) {
    return <div className="flex items-center justify-center min-h-screen">読み込み中...</div>;
  }

  if (!user) {
    return null;
  }

  const upcomingCompetitions = competitions
    ?.filter(comp => new Date(comp.date) > new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) ?? [];

  const nextCompetition = upcomingCompetitions[0];
  const { days, hours } = nextCompetition 
    ? calculateTimeUntilCompetition(new Date(nextCompetition.date))
    : { days: 0, hours: 0 };
  const { currentMonth, lastMonth } = records ? calculateTimeImprovement(records) : {
    currentMonth: { totalImprovement: 0, improvementCount: 0 },
    lastMonth: { totalImprovement: 0, improvementCount: 0 }
  };

  const competition = competitions?.find(c => c.id === editingCompetition);

  const navItems = [
    { label: '選手一覧', icon: <Users className="h-4 w-4" />, href: '/athletes' },
    { label: '歴代記録', icon: <Trophy className="h-4 w-4" />, href: '/all-time-records' },
    { label: '大会記録', icon: <Calendar className="h-4 w-4" />, href: '/competitions' },
    { label: '資料', icon: <ClipboardList className="h-4 w-4" />, href: '/documents' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">SwimTrack</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <Avatar className="h-8 w-8">
                <AvatarImage src="/placeholder.svg?height=32&width=32" alt={user.username} />
                <AvatarFallback>{user.username.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="ml-2 text-sm font-medium text-gray-700">{user.username}</span>
            </div>
            <div className="flex gap-2">
              {user?.role === 'coach' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPasswordList(true)}
                  className="text-gray-600 hover:text-gray-900"
                  title="パスワード管理"
                >
                  <Key className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowLogoutDialog(true)}
                className="text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4" />
              </Button>
              {user?.role === 'coach' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDeleteAccountDialog(true)}
                  className="text-red-600 hover:text-red-900"
                >
                  <UserX className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {!isMobile && (
        <nav className="bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <div className="hidden md:flex items-center space-x-4">
                {navItems.map((item, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className="text-gray-300 hover:bg-gray-700 hover:text-white"
                    onClick={() => navigate(item.href)}
                  >
                    {item.icon}
                    <span className="ml-2">{item.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </nav>
      )}

      {isMobile && <MobileNav items={navItems} />}

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  次の大会まで
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  {nextCompetition ? (
                    <>
                      <p className="text-3xl font-bold text-primary mb-2">
                        {days}日 {hours}時間
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {nextCompetition.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(nextCompetition.date).toLocaleDateString('ja-JP')}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      予定されている大会はありません
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  記録更新
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">今月の記録更新</p>
                    <p className="text-2xl font-bold text-primary">
                      {currentMonth.totalImprovement}秒
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ({currentMonth.improvementCount}回の更新)
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">先月の記録更新</p>
                    <p className="text-2xl font-bold text-primary">
                      {lastMonth.totalImprovement}秒
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ({lastMonth.improvementCount}回の更新)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    今後の大会
                  </div>
                  {user.role === 'coach' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingCompetition(-1)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      追加
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {upcomingCompetitions.length > 0 ? (
                    upcomingCompetitions.map((competition) => (
                      <div 
                        key={competition.id}
                        className="flex justify-between items-start pb-3 border-b last:border-0 last:pb-0"
                      >
                        <div className="space-y-1">
                          <p className="font-medium">{competition.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(competition.date).toLocaleDateString('ja-JP')}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {competition.location}
                          </p>
                        </div>
                        {user.role === 'coach' && (
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingCompetition(competition.id)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteCompetition(competition.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center">
                      予定されている大会はありません
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <AlertDialog 
        open={showLogoutDialog} 
        onOpenChange={setShowLogoutDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ログアウトしますか？</AlertDialogTitle>
            <AlertDialogDescription>
              セッションが終了し、ログイン画面に戻ります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-primary hover:bg-primary/90"
            >
              ログアウト
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog 
        open={showDeleteAccountDialog} 
        onOpenChange={setShowDeleteAccountDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>アカウントを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。アカウントに関連するすべてのデータが削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-red-500 hover:bg-red-600"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {user?.role === 'coach' && (
        <UserPasswordList 
          isOpen={showPasswordList}
          onClose={() => setShowPasswordList(false)}
        />
      )}

      {competition && (
        <EditCompetitionForm
          competition={competition}
          isOpen={!!editingCompetition}
          onClose={() => setEditingCompetition(null)}
          onSubmit={async (data) => {
            if (editingCompetition === -1) {
              await handleCreateCompetition(data);
            } else {
              await handleEditCompetition(editingCompetition, data);
            }
          }}
        />
      )}
    </div>
  );
}
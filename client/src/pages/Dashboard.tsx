import React, { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Users, 
  ClipboardList,
  LogOut,
  UserX,
  Key,
  Trophy
} from 'lucide-react'
import { useUser } from '../hooks/use-user'
import { useLocation } from 'wouter'
import { useMobile } from '../hooks/use-mobile'
import { MobileNav } from '../components/MobileNav'
import { useSwimRecords } from '../hooks/use-swim-records'
import { useRecentActivities } from '../hooks/use-recent-activities'
import { PageHeader } from '../components/PageHeader'
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



export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user, isLoading, logout, deleteAccount } = useUser();
  const isMobile = useMobile();
  const { toast } = useToast();
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

  

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">読み込み中...</div>;
  }

  if (!user) {
    return null;
  }

  const navItems = [
    { label: '選手一覧', icon: <Users className="h-4 w-4" />, href: '/athletes' },
    { label: '大会情報', icon: <Trophy className="h-4 w-4" />, href: '/competitions' },
    { label: '歴代記録', icon: <Trophy className="h-4 w-4" />, href: '/all-time-records' },
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
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>ダッシュボード</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  SwimTrackへようこそ。メニューから機能を選択してください。
                </p>
              </CardContent>
            </Card>

            {user?.role === 'coach' && (
              <Card>
                <CardHeader>
                  <CardTitle>最近の大会と記録</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(() => {
                      const { activities, isLoading, error } = useRecentActivities();

                      if (isLoading) {
                        return <p className="text-muted-foreground">読み込み中...</p>;
                      }

                      if (error) {
                        return <p className="text-destructive">データの取得に失敗しました</p>;
                      }

                      if (!activities?.length) {
                        return <p className="text-muted-foreground">最近の活動はありません</p>;
                      }

                      return activities.map((activity) => (
                        <div
                          key={`${activity.type}-${activity.id}`}
                          className="flex items-center justify-between p-4 rounded-lg border bg-card text-card-foreground shadow-sm"
                        >
                          {activity.type === 'competition' ? (
                            <>
                              <div>
                                <p className="font-medium">{activity.details.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {activity.details.location}
                                </p>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {new Date(activity.date).toLocaleDateString('ja-JP')}
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <p className="font-medium">
                                  {activity.details.style} {activity.details.distance}m
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {activity.details.athleteName} - {activity.details.time}
                                </p>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {new Date(activity.date).toLocaleDateString('ja-JP')}
                              </div>
                            </>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ログアウトしますか？</AlertDialogTitle>
            <AlertDialogDescription>
              ログアウトすると、再度ログインが必要になります。
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

      <AlertDialog 
        open={showDeleteAccountDialog} 
        onOpenChange={setShowDeleteAccountDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>アカウントを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。アカウントと関連するすべてのデータが完全に削除されます。
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

      <UserPasswordList 
        isOpen={showPasswordList}
        onClose={() => setShowPasswordList(false)}
      />
    </div>
  );
}

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
  LogOut
} from 'lucide-react'
import { useUser } from '../hooks/use-user'
import { useLocation } from 'wouter'
import { useMobile } from '../hooks/use-mobile'
import { MobileNav } from '../components/MobileNav'
import { useSwimRecords } from '../hooks/use-swim-records'
import { PageHeader } from '../components/PageHeader'

const calculateTimeUntilCompetition = (competitionDate: Date) => {
  const now = new Date();
  const diffTime = competitionDate.getTime() - now.getTime();
  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return { days, hours };
};

const calculateTimeImprovement = (records: any[]) => {
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  
  const improvements = records
    .filter(record => new Date(record.date) >= lastMonth)
    .reduce((acc, record) => {
      const [mins, secs] = record.time.split(':');
      const totalSeconds = parseInt(mins) * 60 + parseFloat(secs);
      return acc + totalSeconds;
    }, 0);

  return improvements.toFixed(2);
};

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user, isLoading, logout } = useUser();
  const isMobile = useMobile();
  const { records, isLoading: recordsLoading } = useSwimRecords(true);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  if (isLoading || recordsLoading) {
    return <div className="flex items-center justify-center min-h-screen">読み込み中...</div>;
  }

  if (!user) {
    return null;
  }

  // Sample upcoming competitions - This would typically come from an API
  const upcomingCompetitions = [
    {
      name: "全国水泳大会2024",
      date: new Date("2024-12-15"),
      location: "東京アクアティクスセンター"
    },
    {
      name: "ジュニア水泳選手権",
      date: new Date("2024-12-28"),
      location: "大阪プール"
    }
  ];

  const navItems = [
    { label: '選手一覧', icon: <Users className="h-4 w-4" />, href: '/athletes' },
    { label: '歴代ベスト', icon: <Trophy className="h-4 w-4" />, href: '/all-time-records' },
    { label: '大会記録', icon: <Calendar className="h-4 w-4" />, href: '/competitions' },
    { label: '資料', icon: <ClipboardList className="h-4 w-4" />, href: '/documents' },
  ];

  const nextCompetition = upcomingCompetitions[0];
  const { days, hours } = calculateTimeUntilCompetition(nextCompetition.date);
  const timeImprovement = records ? calculateTimeImprovement(records) : 0;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <PageHeader title="スイムコーチ">
        <div className="flex items-center gap-4">
          <Avatar className="h-8 w-8">
            <AvatarImage src="/placeholder.svg?height=32&width=32" alt={user.username} />
            <AvatarFallback>{user.username.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-gray-700 hidden sm:inline">{user.username}</span>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            ログアウト
          </Button>
        </div>
      </PageHeader>

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
                  <p className="text-3xl font-bold text-primary mb-2">
                    {days}日 {hours}時間
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {nextCompetition.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {nextCompetition.date.toLocaleDateString('ja-JP')}
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  先月の記録更新
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary mb-2">
                    {timeImprovement}秒
                  </p>
                  <p className="text-sm text-muted-foreground">
                    平均タイム改善
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  今後の大会
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {upcomingCompetitions.map((competition, index) => (
                    <div 
                      key={index}
                      className="flex flex-col space-y-1 pb-3 border-b last:border-0 last:pb-0"
                    >
                      <p className="font-medium">{competition.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {competition.date.toLocaleDateString('ja-JP')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {competition.location}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
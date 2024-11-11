import React, { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  BarChart, 
  Users, 
  Trophy, 
  Calendar, 
  TrendingUp, 
  Target, 
  ClipboardList
} from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import { useUser } from '../hooks/use-user'
import { useLocation } from 'wouter'
import { useMobile } from '../hooks/use-mobile'
import { MobileNav } from '../components/MobileNav'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user, isLoading, logout } = useUser();
  const isMobile = useMobile();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">読み込み中...</div>;
  }

  if (!user) {
    return null;
  }

  const navItems = [
    { label: '選手一覧', icon: <Users className="h-4 w-4" />, href: '/athletes' },
    { label: 'ベストタイム', icon: <Trophy className="h-4 w-4" />, href: '/best-times' },
    { label: '大会記録', icon: <Calendar className="h-4 w-4" />, href: '/competitions' },
    { label: '資料', icon: <ClipboardList className="h-4 w-4" />, href: '/documents' },
  ];

  // Performance improvement data
  const performanceData = {
    labels: ['1月', '2月', '3月', '4月', '5月', '6月'],
    datasets: [
      {
        label: '平均タイム改善（秒）',
        data: [0, -0.5, -0.8, -1.2, -1.5, -2],
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      }
    ]
  }

  // Swimming style ranking data
  const rankingData = {
    labels: ['自由形', '背泳ぎ', '平泳ぎ', 'バタフライ', '個人メドレー'],
    datasets: [
      {
        label: 'チーム平均順位',
        data: [3, 5, 2, 4, 1],
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      }
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: !isMobile,
    scales: {
      x: {
        type: 'category' as const,
        ticks: {
          maxRotation: isMobile ? 45 : 0,
          minRotation: isMobile ? 45 : 0
        }
      },
      y: {
        beginAtZero: true
      }
    }
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              {isMobile && <MobileNav items={navItems} />}
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900 ml-2">スイムコーチ</h1>
            </div>
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
                ログアウト
              </Button>
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

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>タイム改善推移</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] sm:h-[400px]">
                <Line data={performanceData} options={chartOptions} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>種目別ランキング</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] sm:h-[400px]">
                <Bar data={rankingData} options={chartOptions} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

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
  const { user, isLoading } = useUser();

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
    scales: {
      x: {
        type: 'category' as const,
      },
      y: {
        beginAtZero: true
      }
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">スイムコーチ ダッシュボード</h1>
          <div className="flex items-center gap-4">
            <Avatar className="h-8 w-8">
              <AvatarImage src="/placeholder.svg?height=32&width=32" alt={user.username} />
              <AvatarFallback>{user.username.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-gray-700">{user.username}</span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                const { logout } = useUser();
                logout();
                navigate('/login');
              }}
            >
              ログアウト
            </Button>
          </div>
        </div>
      </header>

      <nav className="bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 text-white font-bold">
                SwimTrack
              </div>
              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  <Button variant="ghost" className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                    <Users className="mr-2 h-4 w-4" />
                    選手一覧
                  </Button>
                  <Button variant="ghost" className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                    <Trophy className="mr-2 h-4 w-4" />
                    ベストタイム
                  </Button>
                  <Button variant="ghost" className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                    <Calendar className="mr-2 h-4 w-4" />
                    大会記録
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                    onClick={() => navigate('/documents')}
                  >
                    <ClipboardList className="mr-2 h-4 w-4" />
                    資料
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>タイム改善推移</CardTitle>
                </CardHeader>
                <CardContent>
                  <Line data={performanceData} options={chartOptions} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>種目別ランキング</CardTitle>
                </CardHeader>
                <CardContent>
                  <Bar data={rankingData} options={chartOptions} />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

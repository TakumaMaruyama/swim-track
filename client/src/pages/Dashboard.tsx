import React, { useEffect, useMemo, useCallback } from 'react'
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
import { useLocation } from 'wouter'
import { useMobile } from '../hooks/use-mobile'
import { MobileNav } from '../components/MobileNav'
import { useRecentActivities } from '../hooks/use-recent-activities'
import { PageHeader } from '../components/PageHeader'
import { ErrorBoundary } from '../components/ErrorBoundary';

// Constants outside component
const NAV_ITEMS = [
  { label: '選手一覧', icon: <Users className="h-4 w-4" />, href: '/athletes' },
  { label: '大会情報', icon: <Trophy className="h-4 w-4" />, href: '/competitions' },
  { label: '歴代記録', icon: <Trophy className="h-4 w-4" />, href: '/all-time-records' },
  { label: '資料', icon: <ClipboardList className="h-4 w-4" />, href: '/documents' },
];

export default function Dashboard() {
  const [, navigate] = useLocation();
  const isMobile = useMobile();
  const { activities, isLoading: isActivitiesLoading, error: activitiesError } = useRecentActivities();

  // All hooks before any conditional returns
  // Remove authentication-related handlers

  // Remove authentication check

  return (
    <ErrorBoundary>
      <div className="flex flex-col min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">SwimTrack</h1>
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-medium">SwimTrack System</h2>
          </div>
        </div>
      </header>

      {!isMobile && (
        <nav className="bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <div className="hidden md:flex items-center space-x-4">
                {NAV_ITEMS.map((item, index) => (
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

      {isMobile && <MobileNav items={NAV_ITEMS} />}

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

            <Card>
              <CardHeader>
                <CardTitle>最近の大会と記録</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {isActivitiesLoading && (
                    <p className="text-muted-foreground">読み込み中...</p>
                  )}
                  {activitiesError && (
                    <p className="text-destructive">データの取得に失敗しました</p>
                  )}
                  {!isActivitiesLoading && !activitiesError && (!activities || activities.length === 0) && (
                    <p className="text-muted-foreground">最近の活動はありません</p>
                  )}
                  {!isActivitiesLoading && !activitiesError && activities && activities.length > 0 && (
                    activities.map((activity) => (
                      <div
                        key={`${activity.type}-${activity.id}`}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card text-card-foreground shadow-sm"
                      >
                        {activity.type === 'competition' && activity.details?.name ? (
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
                        ) : activity.details?.style && activity.details?.distance ? (
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
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Remove authentication-related dialogs */}
      </div>
    </ErrorBoundary>
  );
}
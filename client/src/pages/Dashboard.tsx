import React from 'react';
import { useLocation } from 'wouter';
import { Trophy, Users, Medal, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MobileNav } from '@/components/MobileNav';
import { useMobile } from '@/hooks/use-mobile';
import { AnnouncementCard } from '@/components/AnnouncementCard';

const NAV_ITEMS = [
  { label: '選手一覧', icon: <Users className="h-4 w-4" />, href: '/athletes' },
  { label: '歴代記録', icon: <Trophy className="h-4 w-4" />, href: '/records' },
  { label: 'IM測定ランキング', icon: <Medal className="h-4 w-4" />, href: '/im-rankings' },
  { label: '伸び率ランキング', icon: <TrendingUp className="h-4 w-4" />, href: '/growth-rankings' },
];

export default function Dashboard() {
  const [, navigate] = useLocation();
  const isMobile = useMobile();

  return (
    <ErrorBoundary>
      <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <header className="bg-white border-b">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-600">
                SwimTrack
              </h1>
            </div>
          </div>
        </header>

        {!isMobile && (
          <nav className="bg-white border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center space-x-4">
                  {NAV_ITEMS.map((item, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      className="flex items-center space-x-2 h-12 px-4 hover:bg-gray-50 hover:text-blue-600 transition-colors"
                      onClick={() => navigate(item.href)}
                    >
                      {React.cloneElement(item.icon, { className: "h-5 w-5" })}
                      <span className="font-medium">{item.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </nav>
        )}

        {isMobile && <MobileNav items={NAV_ITEMS} />}

        <main className="flex-grow">
          <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Announcement card */}
              <AnnouncementCard />

              {/* Navigation cards */}
              {NAV_ITEMS.map((item, index) => (
                <Card 
                  key={index}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(item.href)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      {React.cloneElement(item.icon, { className: "h-6 w-6 text-blue-600" })}
                      <span>{item.label}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent />
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

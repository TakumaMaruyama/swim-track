import React from 'react';
import { Button } from "../components/ui/button";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger,
  SheetTitle,
  SheetDescription 
} from "@/components/ui/sheet";
import { Menu } from 'lucide-react';
import { useLocation } from 'wouter';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
}

interface MobileNavProps {
  items: NavItem[];
}

export function MobileNav({ items }: MobileNavProps) {
  const [, navigate] = useLocation();

  const handleNavigate = (href: string) => {
    navigate(href);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">メニューを開く</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[400px]">
        <SheetTitle>メニュー</SheetTitle>
        <SheetDescription>アプリケーションのナビゲーションメニューです</SheetDescription>
        <nav className="flex flex-col gap-4 mt-6">
          {items.map((item, index) => (
            <Button
              key={index}
              variant="ghost"
              className="w-full justify-start"
              onClick={() => handleNavigate(item.href)}
            >
              {item.icon}
              <span className="ml-2">{item.label}</span>
            </Button>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

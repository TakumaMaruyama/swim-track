// PoolCourseSelector.tsx
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

interface PoolCourseSelectorProps {
  value: 'short' | 'long';
  onChange: (value: 'short' | 'long') => void;
  className?: string;
}

export function PoolCourseSelector({ value, onChange, className }: PoolCourseSelectorProps) {
  return (
    <div className={cn("grid grid-cols-2 rounded-md border overflow-hidden", className)}>
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "flex-1 rounded-none border-0",
          value === "short" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
        )}
        onClick={() => onChange("short")}
      >
        短水路 (25m)
      </Button>
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "flex-1 rounded-none border-0",
          value === "long" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
        )}
        onClick={() => onChange("long")}
      >
        長水路 (50m)
      </Button>
    </div>
  );
}
// PoolLengthSelector.tsx
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

interface PoolLengthSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function PoolLengthSelector({ value, onChange, className }: PoolLengthSelectorProps) {
  return (
    <div className={cn("flex rounded-md border overflow-hidden", className)}>
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "flex-1 rounded-none border-0",
          value === "15" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
        )}
        onClick={() => onChange("15")}
      >
        15m
      </Button>
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "flex-1 rounded-none border-0",
          value === "25" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
        )}
        onClick={() => onChange("25")}
      >
        25m（短水路）
      </Button>
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "flex-1 rounded-none border-0",
          value === "50" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
        )}
        onClick={() => onChange("50")}
      >
        50m（長水路）
      </Button>
    </div>
  );
}
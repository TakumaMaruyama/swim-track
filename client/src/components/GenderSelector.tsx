// GenderSelector.tsx
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

interface GenderSelectorProps {
  value: 'male' | 'female';
  onChange: (value: 'male' | 'female') => void;
  className?: string;
}

export function GenderSelector({ value, onChange, className }: GenderSelectorProps) {
  return (
    <div className={cn("flex rounded-md border overflow-hidden", className)}>
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "flex-1 rounded-none border-0",
          value === 'male' ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
        )}
        onClick={() => onChange('male')}
      >
        男子
      </Button>
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "flex-1 rounded-none border-0",
          value === 'female' ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
        )}
        onClick={() => onChange('female')}
      >
        女子
      </Button>
    </div>
  );
}
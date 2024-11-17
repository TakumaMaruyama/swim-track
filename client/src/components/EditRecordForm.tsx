import React from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SwimRecord, Competition } from "db/schema";
import * as z from "zod";
import useSWR from "swr";

// Time format validation regex: MM:SS.ms
const timeRegex = /^([0-5]?[0-9]):([0-5][0-9])\.([0-9]{1,3})$/;

// Pool length configuration with type safety
const POOL_LENGTHS = [15, 25, 50] as const;
type PoolLength = typeof POOL_LENGTHS[number];

// Enhanced pool length validation
const validatePoolLength = (value: number): value is PoolLength => {
  const isValid = POOL_LENGTHS.includes(value as PoolLength);
  console.log(`[Records] Validating pool length ${value}m:`, {
    isValid,
    allowedLengths: POOL_LENGTHS,
    timestamp: new Date().toISOString()
  });
  return isValid;
};

// Get available distances based on pool length
const getAvailableDistances = (poolLength: PoolLength): number[] => {
  console.log(`[Records] Getting available distances for pool length: ${poolLength}m`);
  switch (poolLength) {
    case 15:
      return [15, 30, 60, 90, 120, 240];
    case 25:
      return [25, 50, 100, 200, 400, 800, 1500];
    case 50:
      return [50, 100, 200, 400, 800, 1500];
    default:
      console.warn(`[Records] Invalid pool length: ${poolLength}m`);
      return [];
  }
};

// Enhanced record schema with strict pool length validation
const editRecordSchema = z.object({
  style: z.string().min(1, "種目を選択してください"),
  distance: z.number().min(1, "距離を選択してください"),
  time: z.string().regex(timeRegex, "タイム形式は MM:SS.ms である必要があります"),
  date: z.string().min(1, "日付を選択してください"),
  isCompetition: z.boolean().default(false),
  poolLength: z.number().refine(
    validatePoolLength,
    val => ({
      message: `プール長は ${POOL_LENGTHS.join(', ')}m のいずれかである必要があります。入力値: ${val}m`
    })
  ),
  competitionId: z.number().nullable(),
  studentId: z.number().optional(),
});

type EditRecordFormProps = {
  record?: SwimRecord;
  studentId?: number;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: z.infer<typeof editRecordSchema>) => Promise<void>;
};

export function EditRecordForm({ record, studentId, isOpen, onClose, onSubmit }: EditRecordFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { data: competitions } = useSWR<Competition[]>("/api/competitions");

  // Initialize form with safe default pool length and logging
  const defaultPoolLength: PoolLength = 25;

  React.useEffect(() => {
    if (record?.poolLength) {
      console.log(`[Records] Loading existing record with pool length: ${record.poolLength}m`);
    } else {
      console.log(`[Records] Creating new record with default pool length: ${defaultPoolLength}m`);
    }
  }, [record]);

  const form = useForm<z.infer<typeof editRecordSchema>>({
    resolver: zodResolver(editRecordSchema),
    defaultValues: {
      style: record?.style ?? "",
      distance: record?.distance ?? 50,
      time: record?.time ?? "",
      date: record?.date 
        ? new Date(record.date).toISOString().split('T')[0] 
        : new Date().toISOString().split('T')[0],
      isCompetition: record?.isCompetition ?? false,
      poolLength: (record?.poolLength && POOL_LENGTHS.includes(record.poolLength as PoolLength))
        ? record.poolLength as PoolLength
        : defaultPoolLength,
      competitionId: record?.competitionId ?? null,
      studentId: studentId ?? record?.studentId,
    },
  });

  const watchIsCompetition = form.watch('isCompetition');
  const watchedPoolLength = form.watch('poolLength') as PoolLength;

  const handleSubmit = async (values: z.infer<typeof editRecordSchema>) => {
    try {
      setIsSubmitting(true);
      console.log('[Records] Submitting record:', {
        ...values,
        poolLength: `${values.poolLength}m`,
        type: record ? 'update' : 'create',
        timestamp: new Date().toISOString()
      });

      if (!values.isCompetition) {
        values.competitionId = null;
      }

      await onSubmit(values);
      
      toast({
        title: record ? "更新成功" : "記録追加成功",
        description: record ? "記録が更新されました" : "新しい記録が追加されました",
      });
      onClose();
    } catch (error) {
      console.error('[Records] Error submitting record:', error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: record ? "記録の更新に失敗しました" : "記録の追加に失敗しました",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const swimStyles = [
    "自由形",
    "背泳ぎ",
    "平泳ぎ",
    "バタフライ",
    "個人メドレー"
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{record ? "記録の編集" : "新規記録追加"}</DialogTitle>
          <DialogDescription>
            選手の{record ? "記録を編集" : "新しい記録を追加"}します
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="style"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>種目</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="種目を選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {swimStyles.map(style => (
                        <SelectItem key={style} value={style}>{style}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="poolLength"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>プール長 (m)</FormLabel>
                  <Select
                    value={field.value.toString()}
                    onValueChange={(value) => {
                      const poolLength = Number(value) as PoolLength;
                      console.log(`[Records] Pool length changed to: ${poolLength}m`);
                      field.onChange(poolLength);
                      // Reset distance when pool length changes
                      const availableDistances = getAvailableDistances(poolLength);
                      if (!availableDistances.includes(form.getValues('distance'))) {
                        const newDistance = availableDistances[0];
                        console.log(`[Records] Resetting distance to ${newDistance}m for ${poolLength}m pool`);
                        form.setValue('distance', newDistance);
                      }
                    }}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="プール長を選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {POOL_LENGTHS.map(length => (
                        <SelectItem key={length} value={length.toString()}>
                          {length}mプール
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    選択可能なプール長: {POOL_LENGTHS.join(', ')}m
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="distance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>距離 (m)</FormLabel>
                  <Select
                    value={field.value.toString()}
                    onValueChange={(value) => {
                      const distance = Number(value);
                      console.log(`[Records] Distance changed to: ${distance}m`);
                      field.onChange(distance);
                    }}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="距離を選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {getAvailableDistances(watchedPoolLength).map(d => (
                        <SelectItem key={d} value={d.toString()}>{d}m</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>タイム (MM:SS.ms)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="01:23.45"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    形式: 分:秒.ミリ秒 (例: 01:23.45)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>日付</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isCompetition"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (!checked) {
                          form.setValue('competitionId', null);
                        }
                      }}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>大会記録</FormLabel>
                    <FormDescription>
                      この記録が公式大会での記録の場合はチェックしてください
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            {watchIsCompetition && (
              <FormField
                control={form.control}
                name="competitionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>大会</FormLabel>
                    <Select
                      value={field.value?.toString()}
                      onValueChange={(value) => field.onChange(Number(value))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="大会を選択" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {competitions?.map((competition) => (
                          <SelectItem
                            key={competition.id}
                            value={competition.id.toString()}
                          >
                            {competition.name} ({new Date(competition.date).toLocaleDateString()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {record ? "更新中..." : "追加中..."}
                  </>
                ) : (
                  record ? "更新" : "追加"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
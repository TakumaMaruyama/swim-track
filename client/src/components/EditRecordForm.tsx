import { useEffect, useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { SwimRecord, Competition } from "db/schema";
import useSWR from "swr";
import { useSwimRecords } from '../hooks/use-swim-records';
import * as z from "zod";
import { Loader2 } from "lucide-react";

// UI Components
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

// Constants and Types
const POOL_LENGTHS = [15, 25, 50] as const;
type PoolLength = typeof POOL_LENGTHS[number];

const TIME_FORMAT_REGEX = /^([0-5]?[0-9]):([0-5][0-9])\.([0-9]{1,3})$/;
const SWIM_STYLES = [
  "自由形",
  "背泳ぎ",
  "平泳ぎ",
  "バタフライ",
  "個人メドレー"
] as const;

// Validation functions
const validatePoolLength = (value: number): value is PoolLength => {
  return POOL_LENGTHS.includes(value as PoolLength);
};

// Helper functions
const getAvailableDistances = (poolLength: PoolLength): number[] => {
  switch (poolLength) {
    case 15:
      return [15, 30, 60, 90, 120, 240];
    case 25:
      return [25, 50, 100, 200, 400, 800, 1500];
    case 50:
      return [50, 100, 200, 400, 800, 1500];
    default:
      return [];
  }
};

// Schema definition
const editRecordSchema = z.object({
  style: z.string().min(1, "種目を選択してください"),
  distance: z.number().min(1, "距離を選択してください"),
  time: z.string().regex(TIME_FORMAT_REGEX, "タイム形式は MM:SS.ms である必要があります"),
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: competitions } = useSWR<Competition[]>("/api/competitions");

  const defaultPoolLength: PoolLength = 25;

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

  const { mutate } = useSwimRecords();

const handleSubmit = async (values: z.infer<typeof editRecordSchema>) => {
  let rollback: (() => Promise<any>) | undefined;
  
  try {
    setIsSubmitting(true);
    
    // Prepare optimistic update
    rollback = await optimisticUpdate(
      record ? 'update' : 'create',
      record ? { ...record, ...values } : values
    );
    
    // Perform API call
    await onSubmit(values);
    
    // Update cache with server data
    await mutate(undefined, {
      revalidate: true,
      populateCache: true,
      rollbackOnError: true
    });
    
    onClose();
  } catch (error) {
    console.error('[Records] Error:', error);
    // Execute rollback if available
    if (rollback) {
      await rollback();
    }
    // Force revalidate
    await mutate(undefined, { revalidate: true });
    throw error;
  } finally {
    setIsSubmitting(false);
  }
};

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
                      {SWIM_STYLES.map(style => (
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
                      field.onChange(poolLength);
                      const availableDistances = getAvailableDistances(poolLength);
                      if (!availableDistances.includes(form.getValues('distance'))) {
                        const newDistance = availableDistances[0];
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

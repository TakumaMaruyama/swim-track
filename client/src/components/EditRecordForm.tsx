import { useEffect, useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { SwimRecord, Competition } from "db/schema";
import useSWR from "swr";
import { useSwimRecords } from '../hooks/use-swim-records';
import { useAthletes } from '../hooks/use-athletes';
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
  studentId: z.number({
    required_error: "選手の選択は必須です",
    invalid_type_error: "無効な選手IDです"
  })
  .positive("有効な選手を選択してください")
  .int("無効な選手IDです")
  .refine((val) => val !== undefined && val !== null && val > 0, {
    message: "選手を選択してください"
  })
  .refine((val) => {
    if (typeof window === 'undefined') return true;
    const athletes = form?.getValues()?.athletes;
    return athletes?.some((athlete) => athlete.id === val) ?? false;
  }, {
    message: "選択された選手が見つかりません"
  }),
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
  const { athletes } = useAthletes();

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
      studentId: record?.studentId ?? studentId,
    },
    mode: "onChange",
  });

  const watchIsCompetition = form.watch('isCompetition');
  const watchedPoolLength = form.watch('poolLength') as PoolLength;

  const { mutate } = useSwimRecords();

const handleSubmit = async (values: z.infer<typeof editRecordSchema>) => {
  try {
    setIsSubmitting(true);
    
    // Validate student ID
    const selectedAthlete = athletes?.find(a => a.id === values.studentId);
    if (!selectedAthlete) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "選手が選択されていません。記録を登録するには、有効な選手を選択してください。",
      });
      return;
    }

    if (!values.style || !values.distance || !values.time) {
      toast({
        variant: "destructive",
        title: "入力エラー",
        description: "必須項目（種目、距離、タイム）をすべて入力してください。",
      });
      return;
    }
    
    // Perform API call
    await onSubmit(values);
    
    // Force immediate cache refresh
    await mutate(undefined, { revalidate: true });
    
    toast({
      title: record ? "更新成功" : "記録追加成功",
      description: `${selectedAthlete.username}の記録が${record ? '更新' : '追加'}されました`,
    });
    
    onClose();
  } catch (error) {
    console.error('[Records] Submit error:', error);
    toast({
      variant: "destructive",
      title: "エラー",
      description: error instanceof Error ? error.message : `記録の${record ? '更新' : '追加'}に失敗しました。入力内容を確認してください。`,
    });
  } finally {
    setIsSubmitting(false);
  }
};

  const watchStudentId = form.watch('studentId');
  const isStudentSelected = !!watchStudentId;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{record ? "記録の編集" : "新規記録追加"}</DialogTitle>
          <DialogDescription>
            {record ? "記録を編集" : "新しい記録を追加"}します。続行するには選手を選択してください。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="studentId"
              render={({ field }) => (
                <FormItem className="border-2 border-primary/20 p-4 rounded-lg">
                  <FormLabel className="text-lg font-semibold">
                    選手を選択
                    <span className="text-destructive ml-1">*</span>
                  </FormLabel>
                  <Select
                    value={field.value?.toString() ?? ""}
                    onValueChange={(value) => field.onChange(Number(value))}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="最初に選手を選択してください" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {athletes?.map((athlete) => (
                        <SelectItem
                          key={athlete.id}
                          value={athlete.id.toString()}
                        >
                          {athlete.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-sm mt-2">
                    ※ 記録を登録するには、必ず選手を選択してください
                  </FormDescription>
                  <FormMessage className="font-medium">
                    {field.value ? "" : "選手を選択してください"}
                  </FormMessage>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="style"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>種目</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting || !isStudentSelected}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isStudentSelected ? "種目を選択" : "選手を選択してください"} />
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
                    disabled={isSubmitting || !isStudentSelected}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isStudentSelected ? "プール長を選択" : "選手を選択してください"} />
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
                    disabled={isSubmitting || !isStudentSelected}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isStudentSelected ? "距離を選択" : "選手を選択してください"} />
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
                      disabled={isSubmitting || !isStudentSelected}
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
                      disabled={isSubmitting || !isStudentSelected}
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
                      disabled={isSubmitting || !isStudentSelected}
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
                      disabled={isSubmitting || !isStudentSelected}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isStudentSelected ? "大会を選択" : "選手を選択してください"} />
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

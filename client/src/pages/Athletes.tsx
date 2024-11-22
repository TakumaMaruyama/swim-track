// Import groups organized by type
import { useEffect, useState } from 'react';

// External libraries
import { AlertCircle, Edit2, Plus, Power, History, Trash2 } from "lucide-react";

// Internal hooks
import { useAthletes } from '../hooks/use-athletes';
import { useSwimRecords } from '../hooks/use-swim-records';
import { useUser } from '../hooks/use-user';
import { useToast } from '@/hooks/use-toast';

// Internal components
import { PageHeader } from '../components/PageHeader';
import { EditAthleteForm } from '../components/EditAthleteForm';
import { EditRecordForm } from '../components/EditRecordForm';
import { TimeHistoryModal } from '../components/TimeHistoryModal';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Types
import type { User } from "db/schema";
import type { ExtendedSwimRecord } from "../hooks/use-swim-records";

interface LatestPerformance extends Omit<ExtendedSwimRecord, 'date'> {
  date: string | null;
}

interface ViewingHistoryState {
  athleteId: number | null;
  athleteName: string;
}

interface EditingRecordState {
  id: number | null;
  studentId: number | null;
}

/**
 * Athletes page component that displays a list of athletes and their records
 * Allows coaches to manage athletes and their performance records
 */
export default function Athletes() {
  const { user } = useUser();
  const { toast } = useToast();
  const { athletes, isLoading: athletesLoading, error: athletesError, mutate: mutateAthletes } = useAthletes();
  const { records, isLoading: recordsLoading, error: recordsError, mutate: mutateRecords } = useSwimRecords();
  
  // State management
  const [editingAthlete, setEditingAthlete] = useState<number | null>(null);
  const [deletingAthlete, setDeletingAthlete] = useState<number | null>(null);
  const [editingRecord, setEditingRecord] = useState<EditingRecordState>({
    id: null,
    studentId: null
  });
  const [viewingHistory, setViewingHistory] = useState<ViewingHistoryState>({
    athleteId: null,
    athleteName: ''
  });

  /**
   * Gets the latest performance record for a given athlete
   */
  const getLatestPerformance = (studentId: number): LatestPerformance | null => {
    if (!records) return null;
    const studentRecords = records.filter(record => record.studentId === studentId);
    if (studentRecords.length === 0) return null;
    
    const latestRecord = studentRecords.sort((a, b) => {
      const dateA = new Date(a.date || '').getTime();
      const dateB = new Date(b.date || '').getTime();
      return dateB - dateA;
    })[0];

    return {
      ...latestRecord,
      date: latestRecord.date ? new Date(latestRecord.date).toISOString() : null
    };
  };

  /**
   * Gets all records for a given athlete
   */
  const getAthleteRecords = (studentId: number): ExtendedSwimRecord[] => {
    if (!records) return [];
    return records.filter(record => record.studentId === studentId);
  };

  /**
   * Handles toggling athlete's active status
   */
  const handleToggleStatus = async (athleteId: number, currentStatus: boolean): Promise<void> => {
    try {
      const response = await fetch(`/api/athletes/${athleteId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !currentStatus }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('選手のステータス更新に失敗しました');
      }

      await mutateAthletes();
      toast({
        title: "更新成功",
        description: `選手のステータスが${!currentStatus ? '有効' : '無効'}になりました`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "ステータスの更新に失敗しました",
      });
    }
  };

  /**
   * Handles editing athlete information
   */
  const handleEdit = async (athleteId: number, data: { username: string }): Promise<void> => {
    try {
      const response = await fetch(`/api/athletes/${athleteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('選手情報の更新に失敗しました');
      }

      await mutateAthletes();
    } catch (error) {
      throw error;
    }
  };

  /**
   * Handles creating a new record
   */
  const handleCreateRecord = async (data: Record<string, any>): Promise<void> => {
    try {
      if (!data.studentId) {
        toast({
          variant: "destructive",
          title: "エラー",
          description: "選手IDが設定されていません",
        });
        return;
      }

      const response = await fetch('/api/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          poolLength: Number(data.poolLength),
          studentId: Number(data.studentId),
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '記録の作成に失敗しました');
      }

      // Only revalidate to get the actual server state
      await mutateRecords();
      
      toast({
        title: "追加成功",
        description: "新しい記録が追加されました",
      });
    } catch (error) {
      console.error('[Records] Create error:', error);
      // Force revalidate on error
      await mutateRecords();
      toast({
        variant: "destructive",
        title: "エラー",
        description: error instanceof Error ? error.message : "記録の追加に失敗しました",
      });
      throw error;
    }
  };

  /**
   * Handles editing an existing record
   */
  const handleEditRecord = async (recordId: number, data: Record<string, any>): Promise<void> => {
    try {
      const response = await fetch(`/api/records/${recordId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          poolLength: Number(data.poolLength),
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('記録の更新に失敗しました');
      }

      await mutateRecords();
      toast({
        title: "更新成功",
        description: "記録が更新されました",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "記録の更新に失敗しました",
      });
      throw error;
    }
  };

  /**
   * Handles deleting an athlete and their records
   */
  const handleDelete = async (athleteId: number): Promise<void> => {
    try {
      const response = await fetch(`/api/athletes/${athleteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('選手の削除に失敗しました');
      }

      await Promise.all([
        mutateAthletes(),
        mutateRecords()
      ]);
      
      toast({
        title: "削除成功",
        description: "選手と関連する記録が削除されました",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "選手の削除に失敗しました",
      });
    }
  };

  // Loading state
  if (athletesLoading || recordsLoading) {
    return (
      <>
        <PageHeader title="選手一覧" />
        <div className="container">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-pulse text-lg">データを読み込んでいます...</div>
          </div>
        </div>
      </>
    );
  }

  // Error state
  if (athletesError || recordsError) {
    return (
      <>
        <PageHeader title="選手一覧" />
        <div className="container">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              データの取得中にエラーが発生しました。再度お試しください。
            </AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  const athlete = athletes?.find(a => a.id === editingAthlete);
  const record = records?.find(r => r.id === editingRecord.id);

  return (
    <ErrorBoundary>
      <PageHeader 
        title="選手一覧"
        children={
          user?.role === 'coach' && (
            <Button onClick={() => setEditingRecord({ id: null, studentId: null })}>
              <Plus className="mr-2 h-4 w-4" />
              新規記録追加
            </Button>
          )
        }
      />
      <div className="container px-4 md:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {athletes?.map((athlete) => {
            const latestRecord = getLatestPerformance(athlete.id);
            return (
              <Card 
                key={athlete.id} 
                className={`hover:shadow-lg transition-shadow ${!athlete.isActive ? 'opacity-60' : ''}`}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {athlete.username.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{athlete.username}</span>
                        <Badge variant={athlete.isActive ? "default" : "secondary"}>
                          {athlete.isActive ? '有効' : '無効'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">選手</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewingHistory({ 
                          athleteId: athlete.id,
                          athleteName: athlete.username
                        })}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      {user?.role === 'coach' && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleStatus(athlete.id, athlete.isActive)}
                          >
                            <Power className={`h-4 w-4 ${athlete.isActive ? 'text-green-500' : 'text-red-500'}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingAthlete(athlete.id)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingAthlete(athlete.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {latestRecord ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium text-sm text-muted-foreground">最近の記録:</h3>
                        {user?.role === 'coach' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingRecord({ 
                              id: latestRecord.id, 
                              studentId: athlete.id 
                            })}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-sm font-medium">種目</p>
                          <p className="text-base">{latestRecord.style}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">距離</p>
                          <p className="text-base">{latestRecord.distance}m</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">タイム</p>
                          <p className="text-base font-bold">{latestRecord.time}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">日付</p>
                          <p className="text-base">
                            {latestRecord.date ? new Date(latestRecord.date).toLocaleDateString() : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">記録なし</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {athlete && (
          <EditAthleteForm
            athlete={athlete}
            isOpen={!!editingAthlete}
            onClose={() => setEditingAthlete(null)}
            onSubmit={async (data) => {
              await handleEdit(athlete.id, data);
            }}
          />
        )}

        <EditRecordForm
          record={record}
          studentId={editingRecord.studentId ?? undefined}
          isOpen={editingRecord.id !== null || editingRecord.studentId !== null}
          onClose={() => setEditingRecord({ id: null, studentId: null })}
          onSubmit={async (data) => {
            if (editingRecord.id) {
              await handleEditRecord(editingRecord.id, data);
            } else {
              await handleCreateRecord(data);
            }
          }}
        />

        {viewingHistory.athleteId && (
          <TimeHistoryModal
            isOpen={!!viewingHistory.athleteId}
            onClose={() => setViewingHistory({ athleteId: null, athleteName: '' })}
            records={getAthleteRecords(viewingHistory.athleteId)}
            athleteName={viewingHistory.athleteName}
            onRecordDeleted={() => mutateRecords()}
          />
        )}

        <AlertDialog 
          open={!!deletingAthlete} 
          onOpenChange={(open) => !open && setDeletingAthlete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>選手を削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                この操作は取り消せません。選手に関連するすべての記録も削除されます。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deletingAthlete) {
                    handleDelete(deletingAthlete);
                    setDeletingAthlete(null);
                  }
                }}
                className="bg-red-500 hover:bg-red-600"
              >
                削除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}

import React from 'react';
import { useAthletes } from '../hooks/use-athletes';
import { useSwimRecords } from '../hooks/use-swim-records';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Edit2, Plus, Power, History, Trash2 } from "lucide-react";
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
import { EditAthleteForm } from '../components/EditAthleteForm';
import { EditRecordForm } from '../components/EditRecordForm';
import { TimeHistoryModal } from '../components/TimeHistoryModal';
import { useUser } from '../hooks/use-user';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '../components/PageHeader';
import { Badge } from "@/components/ui/badge";

export default function Athletes() {
  const { user } = useUser();
  const { toast } = useToast();
  const { athletes, isLoading: athletesLoading, error: athletesError, mutate: mutateAthletes } = useAthletes();
  const { records, isLoading: recordsLoading, error: recordsError, mutate: mutateRecords } = useSwimRecords();
  const [editingAthlete, setEditingAthlete] = React.useState<number | null>(null);
  const [deletingAthlete, setDeletingAthlete] = React.useState<number | null>(null);
  const [editingRecord, setEditingRecord] = React.useState<{id: number | null, studentId: number | null}>({
    id: null,
    studentId: null
  });
  const [viewingHistory, setViewingHistory] = React.useState<{
    athleteId: number | null;
    athleteName: string;
  }>({ athleteId: null, athleteName: '' });

  const getLatestPerformance = (studentId: number) => {
    if (!records) return null;
    return records
      .filter(record => record.studentId === studentId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  };

  const getAthleteRecords = (studentId: number) => {
    if (!records) return [];
    return records.filter(record => record.studentId === studentId);
  };

  const handleToggleStatus = async (athleteId: number, currentStatus: boolean) => {
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
        throw new Error('Failed to update athlete status');
      }

      await mutateAthletes();
      toast({
        title: "更新成功",
        description: `選手のステータスが${!currentStatus ? '有効' : '無効'}になりました`,
      });
    } catch (error) {
      console.error('Error updating athlete status:', error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "ステータスの更新に失敗しました",
      });
    }
  };

  const handleEdit = async (athleteId: number, data: { username: string }) => {
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
        throw new Error('Failed to update athlete');
      }

      await mutateAthletes();
    } catch (error) {
      console.error('Error updating athlete:', error);
      throw error;
    }
  };

  const handleCreateRecord = async (data: any) => {
    try {
      console.log('[Records] Creating new record:', {
        ...data,
        poolLength: Number(data.poolLength)
      });
      
      const response = await fetch('/api/records', {
        method: 'POST',
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
        throw new Error('Failed to create record');
      }

      // Force immediate refresh
      await mutateRecords();
      
      // Add a delay before second refresh to ensure data is updated
      await new Promise(resolve => setTimeout(resolve, 500));
      await mutateRecords();

      toast({
        title: "追加成功",
        description: "新しい記録が追加されました",
      });
    } catch (error) {
      console.error('[Records] Error creating record:', error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "記録の追加に失敗しました",
      });
      throw error;
    }
  };

  const handleEditRecord = async (recordId: number, data: any) => {
    try {
      const response = await fetch(`/api/records/${recordId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to update record');
      }

      await mutateRecords();
      toast({
        title: "更新成功",
        description: "記録が更新されました",
      });
    } catch (error) {
      console.error('Error updating record:', error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "記録の更新に失敗しました",
      });
      throw error;
    }
  };

  const handleDelete = async (athleteId: number) => {
    try {
      const response = await fetch(`/api/athletes/${athleteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete athlete');
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
      console.error('Error deleting athlete:', error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "選手の削除に失敗しました",
      });
    }
  };

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
    <>
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
                            onClick={() => setEditingRecord({ id: null, studentId: athlete.id })}
                          >
                            <Plus className="h-4 w-4" />
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
                            {new Date(latestRecord.date).toLocaleDateString()}
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
          isOpen={!!editingRecord.studentId}
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
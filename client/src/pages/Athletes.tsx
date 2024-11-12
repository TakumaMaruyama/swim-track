import React from 'react';
import { useAthletes } from '../hooks/use-athletes';
import { useSwimRecords } from '../hooks/use-swim-records';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Edit2, Plus } from "lucide-react";
import { EditAthleteForm } from '../components/EditAthleteForm';
import { EditRecordForm } from '../components/EditRecordForm';
import { useUser } from '../hooks/use-user';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '../components/PageHeader';

export default function Athletes() {
  const { user } = useUser();
  const { toast } = useToast();
  const { athletes, isLoading: athletesLoading, error: athletesError, mutate: mutateAthletes } = useAthletes();
  const { records, isLoading: recordsLoading, error: recordsError, mutate: mutateRecords } = useSwimRecords();
  const [editingAthlete, setEditingAthlete] = React.useState<number | null>(null);
  const [editingRecord, setEditingRecord] = React.useState<{id: number | null, studentId: number | null}>({
    id: null,
    studentId: null
  });

  const getLatestPerformance = (studentId: number) => {
    if (!records) return null;
    return records
      .filter(record => record.studentId === studentId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
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
      const response = await fetch('/api/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to create record');
      }

      await mutateRecords();
      toast({
        title: "追加成功",
        description: "新しい記録が追加されました",
      });
    } catch (error) {
      console.error('Error creating record:', error);
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
              <Card key={athlete.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {athlete.username.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <span className="text-lg">{athlete.username}</span>
                      <p className="text-sm text-muted-foreground mt-1">選手</p>
                    </div>
                    {user?.role === 'coach' && (
                      <div className="flex gap-2">
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
                      </div>
                    )}
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
      </div>
    </>
  );
}
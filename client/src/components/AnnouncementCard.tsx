import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Edit, Save, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useAuth } from '@/hooks/use-auth';

export function AnnouncementCard() {
  const { announcement, isLoading, error, updateAnnouncement } = useAnnouncements();
  const { isAdmin } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize content from announcement when it loads
  useEffect(() => {
    console.log("Announcement data:", announcement);
    if (announcement?.content) {
      setContent(announcement.content);
    }
  }, [announcement]);

  const handleSave = async () => {
    if (typeof content !== 'string') return;
    
    setIsSaving(true);
    try {
      // Add delay to ensure state is properly updated before API call
      await new Promise(resolve => setTimeout(resolve, 100));
      const result = await updateAnnouncement(content);
      
      // Only exit editing mode if the update was successful
      if (result) {
        setIsEditing(false);
      }
    } catch (error) {
      console.error("Error saving announcement:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setContent(announcement?.content || '');
    setIsEditing(false);
  };

  // デバッグ用
  useEffect(() => {
    // 2秒ごとに最新のお知らせとステータスをコンソールに出力
    const interval = setInterval(() => {
      console.log("Current announcement state:", {
        announcement,
        isLoading,
        error,
        isEditing,
        content,
      });
    }, 2000);
    
    return () => clearInterval(interval);
  }, [announcement, isLoading, error, isEditing, content]);

  if (isLoading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-2xl">
            <span>お知らせ</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse flex flex-col space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-2xl">
            <span>お知らせ</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              お知らせの取得中にエラーが発生しました。
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-2xl">お知らせ</CardTitle>
        
        {isAdmin && !isEditing && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsEditing(true)}
            className="h-8 w-8"
          >
            <Edit className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="お知らせの内容を入力してください..."
              rows={5}
              className="resize-none"
            />
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-1" />
                キャンセル
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <div className="h-4 w-4 border-2 border-t-transparent border-white rounded-full animate-spin mr-1" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                保存
              </Button>
            </div>
          </div>
        ) : (
          <div className="prose dark:prose-invert max-w-none">
            {content ? (
              <p className="text-lg whitespace-pre-wrap">{content}</p>
            ) : (
              <p className="text-lg text-muted-foreground">お知らせはありません</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
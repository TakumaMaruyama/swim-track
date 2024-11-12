import { FileUpload } from "@/components/FileUpload";
import { useDocuments } from "../hooks/use-documents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, Trash2 } from "lucide-react";
import { PageHeader } from '../components/PageHeader';
import { useUser } from '../hooks/use-user';
import { useToast } from '@/hooks/use-toast';
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
import { useState } from "react";

export default function Documents() {
  const { documents, isLoading, mutate } = useDocuments();
  const { user } = useUser();
  const { toast } = useToast();
  const [deletingDocument, setDeletingDocument] = useState<number | null>(null);

  const handleDownload = async (id: number, filename: string) => {
    const response = await fetch(`/api/documents/${id}/download`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  const handleDelete = async (documentId: number) => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      await mutate();
      toast({
        title: "削除成功",
        description: "ドキュメントが削除されました",
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "ドキュメントの削除に失敗しました",
      });
    }
  };

  return (
    <>
      <PageHeader title="トレーニング資料" />
      <div className="container px-4 md:px-8">
        <FileUpload onSuccess={() => mutate()} />

        <div className="grid gap-4 mt-8">
          {isLoading ? (
            <div>読み込み中...</div>
          ) : documents?.map((doc) => (
            <Card key={doc.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{doc.title}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(doc.id, doc.filename)}
                    >
                      <FileDown className="mr-2 h-4 w-4" />
                      ダウンロード
                    </Button>
                    {user?.role === 'coach' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingDocument(doc.id)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        削除
                      </Button>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">
                  アップロード日: {new Date(doc.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <AlertDialog 
          open={!!deletingDocument} 
          onOpenChange={(open) => !open && setDeletingDocument(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ドキュメントを削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                この操作は取り消せません。ドキュメントファイルは完全に削除されます。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deletingDocument) {
                    handleDelete(deletingDocument);
                    setDeletingDocument(null);
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

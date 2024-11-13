import { FileUpload } from "@/components/FileUpload";
import { useDocuments } from "../hooks/use-documents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, Trash2, Loader2 } from "lucide-react";
import { PageHeader } from '../components/PageHeader';
import { useUser } from '../hooks/use-user';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

type GroupedDocuments = {
  [categoryId: string]: {
    categoryName: string;
    documents: Array<{
      id: number;
      title: string;
      filename: string;
      createdAt: string;
      categoryName?: string;
      uploaderName?: string;
    }>;
  };
};

export default function Documents() {
  const { documents, isLoading, error, mutate } = useDocuments();
  const { user } = useUser();
  const { toast } = useToast();
  const [deletingDocument, setDeletingDocument] = useState<number | null>(null);

  const handleDownload = async (id: number, filename: string) => {
    try {
      const response = await fetch(`/api/documents/${id}/download`);
      if (!response.ok) {
        throw new Error('ダウンロードに失敗しました');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "ファイルのダウンロードに失敗しました",
      });
    }
  };

  const handleDelete = async (documentId: number) => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('削除に失敗しました');
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
    } finally {
      setDeletingDocument(null);
    }
  };

  const groupedDocuments: GroupedDocuments = documents?.reduce((acc, doc) => {
    // Use 'none' for documents without a category
    const categoryId = doc.categoryId?.toString() || 'none';
    if (!acc[categoryId]) {
      acc[categoryId] = {
        categoryName: doc.categoryName || 'カテゴリーなし',
        documents: [],
      };
    }
    acc[categoryId].documents.push({
      ...doc,
      createdAt: doc.createdAt?.toString() || new Date().toISOString(),
    });
    return acc;
  }, {} as GroupedDocuments) || {};

  // Sort documents within each category by createdAt DESC
  Object.values(groupedDocuments).forEach(category => {
    category.documents.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });

  return (
    <>
      <PageHeader title="資料" />
      <div className="container px-4 md:px-8">
        <FileUpload onSuccess={() => mutate()} />

        <div className="space-y-8 mt-8">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">読み込み中...</span>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                資料の取得中にエラーが発生しました。再度お試しください。
              </AlertDescription>
            </Alert>
          ) : Object.entries(groupedDocuments).length === 0 ? (
            <div className="text-center text-muted-foreground">
              資料がありません
            </div>
          ) : (
            Object.entries(groupedDocuments).map(([categoryId, { categoryName, documents }]) => (
              <div key={categoryId} className="space-y-4">
                <h2 className="text-2xl font-bold">{categoryName}</h2>
                <div className="grid gap-4">
                  {documents.map((doc) => (
                    <Card key={doc.id}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span>{doc.title}</span>
                            {doc.uploaderName && (
                              <Badge variant="secondary" className="text-xs">
                                アップロード: {doc.uploaderName}
                              </Badge>
                            )}
                          </div>
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
              </div>
            ))
          )}
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

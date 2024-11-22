import { FileUpload } from "@/components/FileUpload";
import { useDocuments } from "../hooks/use-documents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, Trash2, Loader2, ChevronRight } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
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
      categoryId?: number | null;
      categoryName?: string;
    }>;
  };
};

export default function Documents() {
  const { documents, isLoading, error, mutate } = useDocuments();
  const { user } = useUser();
  const { toast } = useToast();
  const [deletingDocument, setDeletingDocument] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<string>("newest");

  const sortDocuments = (docs: typeof documents) => {
    if (!docs) return [];
    return [...docs].sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime();
        case "title_asc":
          return a.title.localeCompare(b.title);
        case "title_desc":
          return b.title.localeCompare(a.title);
        default: // "newest"
          return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
      }
    });
  };

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

  const groupedDocuments: GroupedDocuments = sortDocuments(documents)?.reduce((acc, doc) => {
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

  return (
    <>
      <PageHeader title="資料" />
      <div className="container px-4 md:px-8 max-w-full md:max-w-7xl mx-auto">
        <FileUpload onSuccess={() => mutate()} />

        <div className="flex justify-between items-center mt-8 mb-4">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="並び替え" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">新しい順</SelectItem>
              <SelectItem value="oldest">古い順</SelectItem>
              <SelectItem value="title_asc">タイトル (A-Z)</SelectItem>
              <SelectItem value="title_desc">タイトル (Z-A)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-8">
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
              <Collapsible key={categoryId}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full">
                  <ChevronRight className="h-4 w-4 transition-transform ui-expanded:rotate-90" />
                  <h2 className="text-xl font-bold text-left">{categoryName}</h2>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <div className="grid gap-4">
                    {documents.map((doc) => (
                      <Card key={doc.id}>
                        <CardHeader>
                          <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <span className="text-sm">{doc.title}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload(doc.id, doc.filename)}
                                className="flex-1 sm:flex-none"
                              >
                                <FileDown className="mr-2 h-4 w-4" />
                                ダウンロード
                              </Button>
                              {user?.role === 'coach' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDeletingDocument(doc.id)}
                                  className="flex-1 sm:flex-none text-red-500 hover:text-red-600"
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
                </CollapsibleContent>
              </Collapsible>
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
import { FileUpload } from "@/components/FileUpload";
import { useDocuments } from "../hooks/use-documents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { PageHeader } from '../components/PageHeader';

export default function Documents() {
  const { documents, isLoading, mutate } = useDocuments();

  const handleDownload = async (id: number, filename: string) => {
    const response = await fetch(`/api/documents/${id}/download`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(doc.id, doc.filename)}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    ダウンロード
                  </Button>
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
    </>
  );
}

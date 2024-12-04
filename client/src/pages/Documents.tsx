import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Eye } from "lucide-react";
import { PageHeader } from '../components/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";

export default function Documents() {
  const GOOGLE_DRIVE_URL = "https://drive.google.com/drive/folders/1jguUTQEAaOQ4A8tqBif9E3onhqXcDQb7?usp=drive_link";
  const [previewOpen, setPreviewOpen] = useState(false);

  // Google DriveのフォルダURLをプレビュー用のURLに変換
  const getPreviewUrl = (url: string) => {
    // フォルダIDを抽出
    const folderId = url.match(/folders\/([^/?]+)/)?.[1];
    if (!folderId) return null;
    
    // プレビュー用のURLを生成
    return `https://drive.google.com/embeddedfolderview?id=${folderId}#list`;
  };

  const previewUrl = getPreviewUrl(GOOGLE_DRIVE_URL);

  return (
    <>
      <PageHeader title="資料" />
      <div className="container px-4 md:px-8">
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>SwimTrack 資料ライブラリ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-600">
              すべての資料は下記のGoogle Driveフォルダで管理されています。
              アクセスするには以下のボタンをクリックしてください。
            </p>
            <div className="flex gap-2">
              <Button 
                onClick={() => window.open(GOOGLE_DRIVE_URL, '_blank')}
                className="w-full sm:w-auto"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Google Driveで開く
              </Button>
              <Button
                variant="outline"
                onClick={() => setPreviewOpen(true)}
                className="w-full sm:w-auto"
              >
                <Eye className="mr-2 h-4 w-4" />
                プレビュー
              </Button>
            </div>
          </CardContent>
        </Card>

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl h-[80vh]">
            <DialogHeader>
              <DialogTitle>ドキュメントプレビュー</DialogTitle>
            </DialogHeader>
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
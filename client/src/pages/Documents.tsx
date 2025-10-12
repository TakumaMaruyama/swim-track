import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { PageHeader } from '../components/PageHeader';

export default function Documents() {
  const GOOGLE_DRIVE_URL = "https://drive.google.com/drive/folders/1jguUTQEAaOQ4A8tqBif9E3onhqXcDQb7?usp=drive_link";

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
            <Button 
              onClick={() => window.open(GOOGLE_DRIVE_URL, '_blank')}
              className="w-full sm:w-auto"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Google Driveで開く
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
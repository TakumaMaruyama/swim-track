import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "../hooks/use-user";

interface FileUploadProps {
  onSuccess: () => void;
}

export function FileUpload({ onSuccess }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();
  
  const handleUpload = async (e: React.ChangeEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
      setUploading(true);
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      
      if (!res.ok) {
        throw new Error("アップロードに失敗しました");
      }
      
      toast({
        title: "成功",
        description: "ファイルがアップロードされました",
      });
      onSuccess();
      e.target.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  if (!user || user.role !== "coach") return null;

  return (
    <form onSubmit={handleUpload} className="space-y-4">
      <div className="flex items-center gap-4">
        <Input
          type="text"
          name="title"
          placeholder="ドキュメントタイトル"
          required
        />
        <Input
          type="file"
          name="file"
          accept=".pdf,.pptx,.doc,.docx"
          required
        />
        <Button type="submit" disabled={uploading}>
          {uploading ? "アップロード中..." : "アップロード"}
        </Button>
      </div>
    </form>
  );
}

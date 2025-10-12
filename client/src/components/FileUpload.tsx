import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "../hooks/use-user";
import useSWR from "swr";
import type { Category } from "db/schema";

interface FileUploadProps {
  onSuccess: () => void;
}

export function FileUpload({ onSuccess }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("none");
  const { toast } = useToast();
  const { user } = useUser();
  const { data: categories } = useSWR<Category[]>("/api/categories");

  const handleUpload = async (e: React.ChangeEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    if (selectedCategory !== "none") {
      formData.set("categoryId", selectedCategory);
    } else {
      formData.delete("categoryId");
    }
    
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
      setSelectedCategory("none");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: error.message || "ファイルのアップロードに失敗しました",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "カテゴリー名を入力してください",
      });
      return;
    }

    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newCategoryName.trim() }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("カテゴリーの作成に失敗しました");
      }

      const newCategory = await response.json();
      setNewCategoryName("");
      setShowNewCategory(false);
      setSelectedCategory(newCategory.id.toString());
      
      toast({
        title: "成功",
        description: "カテゴリーが作成されました",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: error.message || "カテゴリーの作成に失敗しました",
      });
    }
  };

  if (!user || user.role !== "coach") return null;

  return (
    <form onSubmit={handleUpload} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Input
          type="text"
          name="title"
          placeholder="ドキュメントタイトル"
          required
          disabled={uploading}
        />
        <div className="flex gap-2">
          <Select
            value={selectedCategory}
            onValueChange={setSelectedCategory}
            disabled={uploading}
          >
            <SelectTrigger>
              <SelectValue placeholder="カテゴリーを選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">カテゴリーなし</SelectItem>
              {categories?.map((category) => (
                <SelectItem key={category.id} value={category.id.toString()}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover open={showNewCategory} onOpenChange={setShowNewCategory}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={uploading}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">新規カテゴリー</h4>
                  <p className="text-sm text-muted-foreground">
                    新しいカテゴリーを作成します
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="カテゴリー名"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                  <Button
                    type="button"
                    onClick={handleCreateCategory}
                    disabled={!newCategoryName.trim()}
                  >
                    作成
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <Input
          type="file"
          name="file"
          accept=".pdf,.pptx,.doc,.docx"
          required
          disabled={uploading}
        />
        <Button type="submit" disabled={uploading}>
          {uploading ? "アップロード中..." : "アップロード"}
        </Button>
      </div>
    </form>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2 } from "lucide-react";
import { useUser } from "@/hooks/use-user";

interface AnnouncementCardProps {
  id: number;
  title: string;
  content: string;
  authorName: string;
  createdAt: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function AnnouncementCard({
  title,
  content,
  authorName,
  createdAt,
  onEdit,
  onDelete,
}: AnnouncementCardProps) {
  const { user } = useUser();
  const isCoach = user?.role === "coach";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-bold">{title}</CardTitle>
        {isCoach && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
              className="h-8 w-8"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-8 w-8 text-red-500 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="whitespace-pre-wrap text-sm text-gray-600">{content}</p>
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>投稿者: {authorName}</span>
            <span>
              {new Date(createdAt).toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

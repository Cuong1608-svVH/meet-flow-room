import { Users, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface Participant {
  peerId: string;
  stream: MediaStream;
  userId: string;
  displayName: string;
  avatarUrl?: string;
}

interface ParticipantsListProps {
  roomId: string;
  participants: Participant[];
  localDisplayName: string;
  localAvatarUrl?: string;
}

export const ParticipantsList = ({ roomId, participants, localDisplayName, localAvatarUrl }: ParticipantsListProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    toast({
      title: "Đã sao chép",
      description: "Mã phòng đã được sao chép vào clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Người tham gia ({participants.length + 1})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Room Code */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Mã phòng:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono truncate">
              {roomId}
            </code>
            <Button
              variant="ghost"
              size="icon"
              onClick={copyRoomCode}
              className="shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Participants List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          <p className="text-sm text-muted-foreground mb-2">Danh sách:</p>
          
          {/* Current User */}
          <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
            <Avatar className="h-9 w-9">
              <AvatarImage src={localAvatarUrl} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {getInitials(localDisplayName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{localDisplayName}</p>
              <Badge variant="secondary" className="text-xs mt-1">
                Bạn
              </Badge>
            </div>
          </div>

          {/* Other Participants */}
          {participants.map((participant) => (
            <div
              key={participant.peerId}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors"
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src={participant.avatarUrl} />
                <AvatarFallback className="bg-secondary text-secondary-foreground text-sm">
                  {getInitials(participant.displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {participant.displayName}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};


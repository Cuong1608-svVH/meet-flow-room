import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface ControlBarProps {
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isScreenSharing: boolean;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onStartScreenShare: () => void;
  onStopScreenShare: () => void;
  onLeave: () => void;
  roomId: string;
}

export const ControlBar = ({
  isVideoEnabled,
  isAudioEnabled,
  isScreenSharing,
  onToggleVideo,
  onToggleAudio,
  onStartScreenShare,
  onStopScreenShare,
  onLeave,
  roomId,
}: ControlBarProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copyRoomLink = () => {
    const link = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast({
      title: "Đã sao chép!",
      description: "Link phòng họp đã được sao chép vào clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-3 bg-control-bg rounded-full shadow-lg border border-border/50">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleVideo}
        className={`h-12 w-12 rounded-full ${!isVideoEnabled ? "bg-destructive hover:bg-destructive/90 text-white" : "bg-muted hover:bg-muted/80 text-foreground"}`}
      >
        {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleAudio}
        className={`h-12 w-12 rounded-full ${!isAudioEnabled ? "bg-destructive hover:bg-destructive/90 text-white" : "bg-muted hover:bg-muted/80 text-foreground"}`}
      >
        {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}
        className={`h-12 w-12 rounded-full ${isScreenSharing ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "bg-muted hover:bg-muted/80 text-foreground"}`}
      >
        <Monitor className="h-6 w-6" />
      </Button>

      <div className="w-px h-8 bg-border" />

      <Button
        variant="ghost"
        size="icon"
        onClick={copyRoomLink}
        className="h-12 w-12 rounded-full bg-muted hover:bg-muted/80 text-foreground"
      >
        {copied ? <Check className="h-6 w-6" /> : <Copy className="h-6 w-6" />}
      </Button>

      <Button
        variant="destructive"
        size="icon"
        onClick={onLeave}
        className="h-12 w-12 rounded-full bg-destructive hover:bg-destructive/90 text-white"
      >
        <PhoneOff className="h-6 w-6" />
      </Button>
    </div>
  );
};

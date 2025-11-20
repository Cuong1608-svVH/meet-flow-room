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
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-3 bg-control-bg rounded-full shadow-lg">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleVideo}
        className={!isVideoEnabled ? "bg-destructive hover:bg-destructive/90" : "hover:bg-control-hover"}
      >
        {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleAudio}
        className={!isAudioEnabled ? "bg-destructive hover:bg-destructive/90" : "hover:bg-control-hover"}
      >
        {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}
        className={isScreenSharing ? "bg-primary hover:bg-primary/90" : "hover:bg-control-hover"}
      >
        <Monitor className="h-5 w-5" />
      </Button>

      <div className="w-px h-8 bg-border" />

      <Button
        variant="ghost"
        size="icon"
        onClick={copyRoomLink}
        className="hover:bg-control-hover"
      >
        {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
      </Button>

      <Button
        variant="destructive"
        size="icon"
        onClick={onLeave}
        className="bg-destructive hover:bg-destructive/90"
      >
        <PhoneOff className="h-5 w-5" />
      </Button>
    </div>
  );
};

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Mic, MicOff, User, Hand } from "lucide-react";

interface VideoTileProps {
  stream: MediaStream | null;
  displayName: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoEnabled?: boolean;
  isHandRaised?: boolean;
  className?: string;
}

export const VideoTile = ({
  stream,
  displayName,
  isLocal = false,
  isMuted = false,
  isVideoEnabled,
  isHandRaised = false,
  className,
}: VideoTileProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      // Force video to play when stream or video enabled state changes
      videoRef.current.play().catch(err => console.log("Video play error:", err));
    }
  }, [stream, isVideoEnabled]);

  const hasVideo = isVideoEnabled !== undefined 
    ? isVideoEnabled 
    : stream?.getVideoTracks().some((track) => track.enabled);

  return (
    <div
      className={cn(
        "relative bg-control-bg rounded-lg overflow-hidden aspect-video flex items-center justify-center",
        className
      )}
    >
      {hasVideo ? (
        <video
          key={`video-${isVideoEnabled}`}
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex items-center justify-center w-full h-full">
          <div className="p-6 bg-control-hover rounded-full">
            <User className="h-12 w-12 text-muted-foreground" />
          </div>
        </div>
      )}

      <div className="absolute bottom-3 left-3 flex items-center gap-2">
        <div className="px-3 py-1 bg-black/60 rounded-full text-sm text-white flex items-center gap-2">
          {isMuted ? (
            <MicOff className="h-3 w-3" />
          ) : (
            <Mic className="h-3 w-3" />
          )}
          <span>{displayName}</span>
        </div>
      </div>

      {isHandRaised && (
        <div className="absolute top-3 left-3 p-2 bg-amber-500 rounded-full animate-pulse">
          <Hand className="h-5 w-5 text-white" />
        </div>
      )}

      {isLocal && (
        <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 rounded text-xs text-white">
          Bạn
        </div>
      )}
    </div>
  );
};

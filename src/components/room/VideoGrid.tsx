import { VideoTile } from "./VideoTile";
import { Participant } from "@/hooks/useWebRTC";
import { cn } from "@/lib/utils";

interface VideoGridProps {
  localStream: MediaStream | null;
  participants: Participant[];
  isAudioEnabled: boolean;
  displayName: string;
}

export const VideoGrid = ({
  localStream,
  participants,
  isAudioEnabled,
  displayName,
}: VideoGridProps) => {
  const totalParticipants = participants.length + 1; // +1 for local user

  const getGridClass = () => {
    if (totalParticipants === 1) return "grid-cols-1";
    if (totalParticipants === 2) return "grid-cols-2";
    if (totalParticipants <= 4) return "grid-cols-2";
    if (totalParticipants <= 6) return "grid-cols-3";
    return "grid-cols-3";
  };

  return (
    <div
      className={cn(
        "grid gap-4 w-full h-full p-4",
        getGridClass()
      )}
    >
      <VideoTile
        stream={localStream}
        displayName={displayName}
        isLocal
        isMuted={!isAudioEnabled}
      />

      {participants.map((participant) => (
        <VideoTile
          key={participant.peerId}
          stream={participant.stream}
          displayName={participant.displayName}
        />
      ))}
    </div>
  );
};

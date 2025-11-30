import { VideoTile } from "./VideoTile";
import { Participant } from "@/hooks/useWebRTC";
import { cn } from "@/lib/utils";

interface VideoGridProps {
  localStream: MediaStream | null;
  participants: Participant[];
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  displayName: string;
  isScreenSharing: boolean;
  screenStream: MediaStream | null;
  cameraStream: MediaStream | null;
}

export const VideoGrid = ({
  localStream,
  participants,
  isAudioEnabled,
  isVideoEnabled,
  displayName,
  isScreenSharing,
  screenStream,
  cameraStream,
}: VideoGridProps) => {
  const totalParticipants = participants.length + 1;

  const getGridClass = () => {
    if (totalParticipants === 1) return "grid-cols-1";
    if (totalParticipants === 2) return "grid-cols-2";
    if (totalParticipants <= 4) return "grid-cols-2";
    if (totalParticipants <= 6) return "grid-cols-3";
    return "grid-cols-3";
  };

  // Layout đặc biệt khi share màn hình (giống Google Meet)
  if (isScreenSharing && screenStream) {
    return (
      <div className="flex gap-4 w-full h-full p-4">
        {/* Màn hình share - hiển thị lớn */}
        <div className="flex-1">
          <VideoTile
            stream={screenStream}
            displayName={`${displayName} (Đang chia sẻ)`}
            isLocal
            isMuted={!isAudioEnabled}
            isVideoEnabled={true}
          />
        </div>

        {/* Sidebar với camera và participants - hiển thị nhỏ */}
        <div className="w-64 flex flex-col gap-2 overflow-y-auto">
          {/* Camera của người share */}
          <VideoTile
            stream={cameraStream}
            displayName={displayName}
            isLocal
            isMuted={!isAudioEnabled}
            isVideoEnabled={isVideoEnabled}
          />

          {/* Các participants khác */}
          {participants.map((participant) => (
            <VideoTile
              key={participant.peerId}
              stream={participant.stream}
              displayName={participant.displayName}
            />
          ))}
        </div>
      </div>
    );
  }

  // Layout thông thường (grid)
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
        isVideoEnabled={isVideoEnabled}
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

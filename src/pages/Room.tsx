import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useWebRTC } from "@/hooks/useWebRTC";
import { VideoGrid } from "@/components/room/VideoGrid";
import { ChatPanel } from "@/components/room/ChatPanel";
import { ControlBar } from "@/components/room/ControlBar";
import { useToast } from "@/hooks/use-toast";

const Room = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showChat, setShowChat] = useState(true);
  const [displayName, setDisplayName] = useState("User");

  const {
    localStream,
    participants,
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    toggleVideo,
    toggleAudio,
    startScreenShare,
    stopScreenShare,
    callPeer,
    myPeerId,
  } = useWebRTC(roomId!, user?.id!, displayName);

  useEffect(() => {
    if (!user || !roomId) return;

    const initRoom = async () => {
      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      if (profile) {
        setDisplayName(profile.display_name || "User");
      }

      // Join room
      const { error } = await supabase.from("room_participants").insert({
        room_id: roomId,
        user_id: user.id,
      });

      if (error) {
        console.error("Error joining room:", error);
      }

      // Subscribe to new participants
      const channel = supabase
        .channel(`room:${roomId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "room_participants",
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            if (payload.new.user_id !== user.id && myPeerId) {
              const newPeerId = `${roomId}-${payload.new.user_id}`;
              setTimeout(() => callPeer(newPeerId), 1000);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    initRoom();
  }, [roomId, user, myPeerId]);

  const handleLeave = async () => {
    if (user && roomId) {
      await supabase
        .from("room_participants")
        .update({ is_active: false, left_at: new Date().toISOString() })
        .eq("room_id", roomId)
        .eq("user_id", user.id);
    }
    navigate("/");
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="h-screen bg-room-bg flex flex-col">
      <div className="flex-1 flex">
        <div className="flex-1 relative">
          <VideoGrid
            localStream={localStream}
            participants={participants}
            isAudioEnabled={isAudioEnabled}
            displayName={displayName}
          />
          <ControlBar
            isVideoEnabled={isVideoEnabled}
            isAudioEnabled={isAudioEnabled}
            isScreenSharing={isScreenSharing}
            onToggleVideo={toggleVideo}
            onToggleAudio={toggleAudio}
            onStartScreenShare={startScreenShare}
            onStopScreenShare={stopScreenShare}
            onLeave={handleLeave}
            roomId={roomId!}
          />
        </div>
        {showChat && (
          <div className="w-80">
            <ChatPanel roomId={roomId!} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Room;

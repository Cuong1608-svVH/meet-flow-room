import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useWebRTC } from "@/hooks/useWebRTC";
import { VideoGrid } from "@/components/room/VideoGrid";
import { ChatPanel } from "@/components/room/ChatPanel";
import { ControlBar } from "@/components/room/ControlBar";
import { ParticipantsList } from "@/components/room/ParticipantsList";
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
      console.log("🔵 Initializing room:", roomId, "User:", user.id);
      
      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      if (profile) {
        setDisplayName(profile.display_name || "User");
      }

      // Use upsert to handle both new join and rejoin cases
      console.log("🔄 Joining/rejoining room");
      const { error } = await supabase
        .from("room_participants")
        .upsert(
          {
            room_id: roomId,
            user_id: user.id,
            is_active: true,
            left_at: null,
          },
          {
            onConflict: 'room_id,user_id',
          }
        );

      if (error) {
        console.error("❌ Error joining room:", error);
      }

      // Get all existing active participants and call them
      console.log("👤 My peer ID:", myPeerId);
      if (myPeerId) {
        const { data: existingParticipants } = await supabase
          .from("room_participants")
          .select("user_id")
          .eq("room_id", roomId)
          .eq("is_active", true)
          .neq("user_id", user.id);

        console.log("👥 Existing participants:", existingParticipants);
        
        if (existingParticipants && existingParticipants.length > 0) {
          existingParticipants.forEach((participant) => {
            const peerId = `${roomId}-${participant.user_id}`;
            console.log("📞 Calling peer:", peerId);
            setTimeout(() => callPeer(peerId), 1000);
          });
        } else {
          console.log("ℹ️ No existing participants to call");
        }
      } else {
        console.warn("⚠️ My peer ID not ready yet");
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
          async (payload) => {
            console.log("🔔 INSERT event received:", payload);
            if (payload.new.user_id !== user.id) {
              // Get participant name and show notification
              const { data: participantProfile } = await supabase
                .from("profiles")
                .select("display_name")
                .eq("id", payload.new.user_id)
                .single();

              const participantName = participantProfile?.display_name || "Người dùng mới";
              
              toast({
                title: "Có người tham gia",
                description: `${participantName} đã tham gia phòng`,
              });

              if (myPeerId) {
                const newPeerId = `${roomId}-${payload.new.user_id}`;
                console.log("📞 Calling new peer:", newPeerId);
                setTimeout(() => callPeer(newPeerId), 1000);
              } else {
                console.warn("⚠️ Cannot call new peer - myPeerId not ready");
              }
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "room_participants",
            filter: `room_id=eq.${roomId}`,
          },
          async (payload) => {
            console.log("🔔 UPDATE event received:", payload);
            // Show notification when someone rejoins (is_active changes to true)
            if (payload.new.user_id !== user.id && payload.new.is_active && !payload.old.is_active) {
              const { data: participantProfile } = await supabase
                .from("profiles")
                .select("display_name")
                .eq("id", payload.new.user_id)
                .single();

              const participantName = participantProfile?.display_name || "Người dùng mới";
              
              toast({
                title: "Có người tham gia",
                description: `${participantName} đã tham gia phòng`,
              });

              if (myPeerId) {
                const newPeerId = `${roomId}-${payload.new.user_id}`;
                console.log("📞 Calling rejoining peer:", newPeerId);
                setTimeout(() => callPeer(newPeerId), 1000);
              } else {
                console.warn("⚠️ Cannot call rejoining peer - myPeerId not ready");
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanup = initRoom();
    return () => {
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, [roomId, user]);

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
        <div className="w-80 flex flex-col gap-2 p-2">
          <div className="flex-1 overflow-hidden">
            <ParticipantsList
              roomId={roomId!}
              participants={participants}
              localDisplayName={displayName}
            />
          </div>
          {showChat && (
            <div className="flex-1 overflow-hidden">
              <ChatPanel roomId={roomId!} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Room;

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useWebRTC } from "@/hooks/useWebRTC";
import { VideoGrid } from "@/components/room/VideoGrid";
import { ChatPanel } from "@/components/room/ChatPanel";
import { ControlBar } from "@/components/room/ControlBar";
import { ParticipantsList } from "@/components/room/ParticipantsList";

const Room = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [showChat, setShowChat] = useState(true);
  const [displayName, setDisplayName] = useState("User");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  const {
    localStream,
    participants,
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    isSomeoneScreenSharing,
    isHandRaised,
    activeReactions,
    isPeerReady,
    toggleVideo,
    toggleAudio,
    startScreenShare,
    stopScreenShare,
    toggleHandRaise,
    sendReaction,
    removeReaction,
    callPeer,
    myPeerId,
    screenStream,
    cameraStream,
  } = useWebRTC(roomId!, user?.id!, displayName);

  useEffect(() => {
    if (!user || !roomId) return;

    const initRoom = async () => {
      console.log("🔵 Initializing room:", roomId, "User:", user.id);
      
      // Get user profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setDisplayName(profileData.display_name || "User");
        setAvatarUrl(profileData.avatar_url || undefined);
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
      console.log("👤 My peer ID:", myPeerId, "Peer ready:", isPeerReady);
      const { data: existingParticipants } = await supabase
        .from("room_participants")
        .select("user_id")
        .eq("room_id", roomId)
        .eq("is_active", true)
        .neq("user_id", user.id);

      console.log("👥 Existing participants:", existingParticipants);
      
      // Store participants to call when peer is ready
      const participantsToCall = existingParticipants?.map(p => `${roomId}-${p.user_id}`) || [];
      
      if (participantsToCall.length > 0) {
        console.log("📞 Will call existing participants:", participantsToCall);
        // Call immediately without stagger for faster connection
        participantsToCall.forEach(peerId => {
          callPeer(peerId);
        });
      } else {
        console.log("ℹ️ No existing participants to call");
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
              const newPeerId = `${roomId}-${payload.new.user_id}`;
              console.log("📞 Calling new peer immediately:", newPeerId);
              callPeer(newPeerId);
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
            if (payload.new.user_id !== user.id && payload.new.is_active && !payload.old.is_active) {
              const newPeerId = `${roomId}-${payload.new.user_id}`;
              console.log("📞 Calling rejoining peer immediately:", newPeerId);
              callPeer(newPeerId);
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
            isVideoEnabled={isVideoEnabled}
            displayName={displayName}
            isScreenSharing={isScreenSharing}
            screenStream={screenStream}
            cameraStream={cameraStream}
            isHandRaised={isHandRaised}
            activeReactions={activeReactions}
            myPeerId={myPeerId}
            onReactionComplete={removeReaction}
          />
          <ControlBar
            isVideoEnabled={isVideoEnabled}
            isAudioEnabled={isAudioEnabled}
            isScreenSharing={isScreenSharing}
            isSomeoneScreenSharing={isSomeoneScreenSharing}
            isHandRaised={isHandRaised}
            onToggleVideo={toggleVideo}
            onToggleAudio={toggleAudio}
            onStartScreenShare={startScreenShare}
            onStopScreenShare={stopScreenShare}
            onToggleHandRaise={toggleHandRaise}
            onSendReaction={sendReaction}
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
              localAvatarUrl={avatarUrl}
              localIsHandRaised={isHandRaised}
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

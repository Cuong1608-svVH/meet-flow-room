import Peer, { MediaConnection } from "peerjs";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Participant {
  peerId: string;
  stream: MediaStream;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  isScreenSharing: boolean;
  screenStream?: MediaStream;
  isHandRaised?: boolean;
}

export const useWebRTC = (roomId: string, userId: string, displayName: string) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isPeerReady, setIsPeerReady] = useState(false);
  const [isSomeoneScreenSharing, setIsSomeoneScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);

  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, MediaConnection>>(new Map());
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const pendingCallsRef = useRef<Set<string>>(new Set());
  const retryTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    const initWebRTC = async () => {
      try {
        // -------------------------------
        // 1️⃣ Lấy CAM & MIC ngay khi vào phòng
        // -------------------------------
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        cameraStreamRef.current = stream;

        // Subscribe to screen sharing changes
        const screenShareChannel = supabase
          .channel(`screen-share:${roomId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "room_participants",
              filter: `room_id=eq.${roomId}`,
            },
            (payload: any) => {
              // Update participant's screen sharing and hand raised status
              if (payload.new?.user_id) {
                const peerId = `${roomId}-${payload.new.user_id}`;
                setParticipants((prev) =>
                  prev.map((p) =>
                    p.peerId === peerId
                      ? { 
                          ...p, 
                          isScreenSharing: payload.new.is_screen_sharing || false,
                          isHandRaised: payload.new.is_hand_raised || false
                        }
                      : p
                  )
                );
              }

              // Check if anyone else is screen sharing
              if (payload.new?.user_id !== userId && payload.new?.is_screen_sharing) {
                setIsSomeoneScreenSharing(true);
              } else {
                // Check all participants
                supabase
                  .from("room_participants")
                  .select("is_screen_sharing")
                  .eq("room_id", roomId)
                  .neq("user_id", userId)
                  .eq("is_active", true)
                  .eq("is_screen_sharing", true)
                  .then(({ data }) => {
                    setIsSomeoneScreenSharing(data && data.length > 0);
                  });
              }
            }
          )
          .subscribe();

        // -------------------------------
        // 2️⃣ Tạo Peer ID theo format: roomId-userId
        // -------------------------------
        const peer = new Peer(`${roomId}-${userId}`, {
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
              {
                urls: "turn:openrelay.metered.ca:80",
                username: "openrelayproject",
                credential: "openrelayproject",
              },
            ],
          },
        });

        peerRef.current = peer;

        // ------------------------------------
        // 3️⃣ Khi peer kết nối xong → gọi tất cả pending peers
        // ------------------------------------
        peer.on("open", () => {
          setIsPeerReady(true);

          const pending = [...pendingCallsRef.current];
          pendingCallsRef.current.clear();

          pending.forEach((id) => callPeerInternal(id));
        });

        // ------------------------------------
        // 4️⃣ Người khác gọi đến → answer NGAY
        // ------------------------------------
        peer.on("call", (call) => {
          // Check if this is a screen share call via metadata
          const isScreenCall = call.metadata?.type === 'screen';
          
          call.answer(stream);
          
          // Chỉ gọi lại để đảm bảo kết nối 2 chiều nếu KHÔNG phải screen call
          if (!isScreenCall && !connectionsRef.current.has(call.peer)) {
            setTimeout(() => callPeerInternal(call.peer), 120);
          }

          call.on("stream", async (remoteStream) => {
            if (isScreenCall) {
              // This is a screen share stream - add it as screenStream
              setParticipants((prev) =>
                prev.map((p) =>
                  p.peerId === call.peer
                    ? { ...p, screenStream: remoteStream }
                    : p
                )
              );
              
              // Store connection with screen identifier
              connectionsRef.current.set(`${call.peer}-screen-in`, call);
            } else {
              // This is a regular camera stream
              await addParticipant(call.peer, remoteStream);
              connectionsRef.current.set(call.peer, call);
            }
          });

          call.on("close", () => {
            if (isScreenCall) {
              // Chỉ xóa screenStream, KHÔNG xóa participant
              setParticipants((p) => 
                p.map((x) => x.peerId === call.peer ? { ...x, screenStream: undefined } : x)
              );
              connectionsRef.current.delete(`${call.peer}-screen-in`);
            } else {
              // Camera connection đóng - xóa participant
              setParticipants((p) => p.filter((x) => x.peerId !== call.peer));
              connectionsRef.current.delete(call.peer);
            }
          });
        });

        peer.on("error", (e) => console.error("Peer error:", e));
      } catch (e) {
        console.error("Camera error:", e);
      }
    };

    initWebRTC();

    return () => {
      localStream?.getTracks().forEach((t) => t.stop());
      connectionsRef.current.forEach((c) => c.close());
      peerRef.current?.destroy();
      supabase.removeChannel(supabase.channel(`screen-share:${roomId}`));
    };
  }, []);

  // ---------------------------------------
  // 📌 Hàm thêm participant (không trùng)
  // ---------------------------------------
  const addParticipant = async (peerId: string, stream: MediaStream) => {
    // Check if this is a screen share stream
    const isScreenStream = peerId.endsWith("-screen");
    const basePeerId = isScreenStream ? peerId.replace("-screen", "") : peerId;
    const participantUserId = basePeerId.substring(roomId.length + 1);

    if (isScreenStream) {
      // Add screen stream to existing participant
      setParticipants((prev) =>
        prev.map((p) =>
          p.peerId === basePeerId
            ? { ...p, screenStream: stream }
            : p
        )
      );
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", participantUserId)
      .maybeSingle();

    const { data: roomParticipant } = await supabase
      .from("room_participants")
      .select("is_screen_sharing, is_hand_raised")
      .eq("room_id", roomId)
      .eq("user_id", participantUserId)
      .maybeSingle();

    const name = profile?.display_name || "User";
    const avatarUrl = profile?.avatar_url || undefined;
    const isScreenSharing = roomParticipant?.is_screen_sharing || false;
    const isHandRaised = roomParticipant?.is_hand_raised || false;

    setParticipants((prev) => {
      if (prev.some((p) => p.peerId === peerId)) return prev;
      return [...prev, { peerId, stream, userId: participantUserId, displayName: name, avatarUrl, isScreenSharing, isHandRaised }];
    });
  };

  // ---------------------------------------
  // 📌 Hàm gọi peer nội bộ
  // ---------------------------------------
  const callPeerInternal = (peerId: string) => {
    if (!peerRef.current || !localStream) return;

    if (connectionsRef.current.has(peerId)) return;

    const call = peerRef.current.call(peerId, localStream);

    call.on("stream", async (remoteStream) => {
      await addParticipant(peerId, remoteStream);
    });

    call.on("close", () => {
      setParticipants((p) => p.filter((x) => x.peerId !== peerId));
      connectionsRef.current.delete(peerId);
    });

    connectionsRef.current.set(peerId, call);
  };

  // ---------------------------------------
  // 📌 Hàm gọi peer công khai
  // ---------------------------------------
  const callPeer = (peerId: string) => {
    if (!isPeerReady) {
      pendingCallsRef.current.add(peerId);
      return;
    }
    callPeerInternal(peerId);
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      screenStreamRef.current = screenStream;
      
      // Create new peer connections for screen sharing
      if (!peerRef.current) return;
      
      // Only send screen to actual participants (base peer IDs without any suffixes)
      const baseParticipantIds = Array.from(connectionsRef.current.keys()).filter(
        peerId => !peerId.includes("-screen")
      );
      
      baseParticipantIds.forEach((peerId) => {
        // Gửi metadata để người nhận biết đây là screen share
        const screenCall = peerRef.current!.call(peerId, screenStream, {
          metadata: { type: 'screen' }
        });
        
        screenCall.on("close", () => {
          connectionsRef.current.delete(`${peerId}-screen-out`);
        });
        
        connectionsRef.current.set(`${peerId}-screen-out`, screenCall);
      });

      setIsScreenSharing(true);

      // Update database
      await supabase
        .from("room_participants")
        .update({ is_screen_sharing: true })
        .eq("room_id", roomId)
        .eq("user_id", userId);

      // Handle when user stops sharing via browser UI
      const videoTrack = screenStream.getVideoTracks()[0];
      videoTrack.onended = () => {
        stopScreenShare();
      };
    } catch (error) {
      console.error("Error starting screen share:", error);
    }
  };

  const stopScreenShare = async () => {
    if (!screenStreamRef.current) return;

    try {
      // Stop screen share tracks
      screenStreamRef.current.getTracks().forEach((track) => track.stop());

      // Close all screen share peer connections
      connectionsRef.current.forEach((connection, key) => {
        if (key.includes("-screen")) {
          connection.close();
          connectionsRef.current.delete(key);
        }
      });

      screenStreamRef.current = null;
      setIsScreenSharing(false);

      // Update database
      await supabase
        .from("room_participants")
        .update({ is_screen_sharing: false })
        .eq("room_id", roomId)
        .eq("user_id", userId);
    } catch (error) {
      console.error("Error stopping screen share:", error);
    }
  };

  const toggleHandRaise = async () => {
    const newValue = !isHandRaised;
    setIsHandRaised(newValue);

    await supabase
      .from("room_participants")
      .update({ is_hand_raised: newValue })
      .eq("room_id", roomId)
      .eq("user_id", userId);
  };

  return {
    localStream,
    participants,
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    isSomeoneScreenSharing,
    isHandRaised,
    isPeerReady,
    toggleVideo,
    toggleAudio,
    startScreenShare,
    stopScreenShare,
    toggleHandRaise,
    callPeer,
    myPeerId: peerRef.current?.id,
    screenStream: screenStreamRef.current,
    cameraStream: cameraStreamRef.current,
  };
};

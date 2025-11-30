import Peer, { MediaConnection } from "peerjs";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Participant {
  peerId: string;
  stream: MediaStream;
  userId: string;
  displayName: string;
}

export const useWebRTC = (roomId: string, userId: string, displayName: string) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isPeerReady, setIsPeerReady] = useState(false);

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
          call.answer(stream);

          // gọi lại để đảm bảo kết nối 2 chiều
          if (!connectionsRef.current.has(call.peer)) {
            setTimeout(() => callPeerInternal(call.peer), 120);
          }

          call.on("stream", async (remoteStream) => {
            await addParticipant(call.peer, remoteStream);
          });

          call.on("close", () => {
            setParticipants((p) => p.filter((x) => x.peerId !== call.peer));
            connectionsRef.current.delete(call.peer);
          });

          connectionsRef.current.set(call.peer, call);
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
    };
  }, []);

  // ---------------------------------------
  // 📌 Hàm thêm participant (không trùng)
  // ---------------------------------------
  const addParticipant = async (peerId: string, stream: MediaStream) => {
    const participantUserId = peerId.substring(roomId.length + 1);

    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", participantUserId)
      .maybeSingle();

    const name = data?.display_name || "User";

    setParticipants((prev) => {
      if (prev.some((p) => p.peerId === peerId)) return prev;
      return [...prev, { peerId, stream, userId: participantUserId, displayName: name }];
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
      
      // Replace video track in all peer connections with screen track
      const videoTrack = screenStream.getVideoTracks()[0];
      connectionsRef.current.forEach((connection) => {
        const sender = connection.peerConnection
          .getSenders()
          .find((s) => s.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });

      setIsScreenSharing(true);

      // Handle when user stops sharing via browser UI
      videoTrack.onended = () => {
        stopScreenShare();
      };
    } catch (error) {
      console.error("Error starting screen share:", error);
    }
  };

  const stopScreenShare = async () => {
    if (!screenStreamRef.current || !cameraStreamRef.current) return;

    try {
      // Stop screen share tracks
      screenStreamRef.current.getTracks().forEach((track) => track.stop());

      // Get camera video track
      const cameraVideoTrack = cameraStreamRef.current.getVideoTracks()[0];

      // Replace video track in all peer connections back to camera
      connectionsRef.current.forEach((connection) => {
        const sender = connection.peerConnection
          .getSenders()
          .find((s) => s.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(cameraVideoTrack);
        }
      });

      screenStreamRef.current = null;
      setIsScreenSharing(false);
    } catch (error) {
      console.error("Error stopping screen share:", error);
    }
  };

  return {
    localStream,
    participants,
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    isPeerReady,
    toggleVideo,
    toggleAudio,
    startScreenShare,
    stopScreenShare,
    callPeer,
    myPeerId: peerRef.current?.id,
    screenStream: screenStreamRef.current,
    cameraStream: cameraStreamRef.current,
  };
};

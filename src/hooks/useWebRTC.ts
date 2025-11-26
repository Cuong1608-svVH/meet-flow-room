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
  const pendingCallsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const initWebRTC = async () => {
      try {
        // Get local media stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);

        // Initialize PeerJS
        const peer = new Peer(`${roomId}-${userId}`, {
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
            ],
          },
        });

        peerRef.current = peer;

        peer.on("open", (id) => {
          console.log("✅ Peer connected! My peer ID is:", id);
          setIsPeerReady(true);
          
          // Process any pending calls
          pendingCallsRef.current.forEach((peerId) => {
            console.log("📞 Calling pending peer:", peerId);
            callPeerInternal(peerId);
          });
          pendingCallsRef.current.clear();
        });

        peer.on("call", (call) => {
          console.log("📞 Incoming call from:", call.peer);
          // Answer the call with local stream
          call.answer(stream);
          
          call.on("stream", async (remoteStream) => {
            console.log("📺 Received stream from:", call.peer);
            
            // Get participant display name from database
            const participantUserId = call.peer.split("-")[1] || "";
            const { data: profile } = await supabase
              .from("profiles")
              .select("display_name")
              .eq("id", participantUserId)
              .single();
            
            const displayName = profile?.display_name || "User";
            
            // Add remote participant
            setParticipants((prev) => {
              // Check if participant already exists
              if (prev.some((p) => p.peerId === call.peer)) {
                console.log("ℹ️ Participant already exists:", call.peer);
                return prev;
              }
              console.log("➕ Adding new participant:", call.peer, "with name:", displayName);
              return [
                ...prev,
                {
                  peerId: call.peer,
                  stream: remoteStream,
                  userId: participantUserId,
                  displayName,
                },
              ];
            });
          });

          call.on("close", () => {
            console.log("❌ Call closed with:", call.peer);
            setParticipants((prev) => prev.filter((p) => p.peerId !== call.peer));
          });

          connectionsRef.current.set(call.peer, call);
        });

        peer.on("error", (error) => {
          console.error("Peer error:", error);
        });

      } catch (error) {
        console.error("Error accessing media devices:", error);
      }
    };

    initWebRTC();

    return () => {
      // Cleanup
      localStream?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      connectionsRef.current.forEach((conn) => conn.close());
      peerRef.current?.destroy();
    };
  }, [roomId, userId]);

  const callPeerInternal = async (peerId: string) => {
    if (!localStream || !peerRef.current) {
      console.warn("⚠️ Cannot call peer - localStream or peerRef not ready");
      return;
    }

    console.log("📞 Calling peer:", peerId);
    const call = peerRef.current.call(peerId, localStream);
    
    call.on("stream", async (remoteStream) => {
      console.log("📺 Received stream from:", peerId);
      
      // Get participant display name from database
      const participantUserId = peerId.split("-")[1] || "";
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", participantUserId)
        .single();
      
      const displayName = profile?.display_name || "User";
      
      setParticipants((prev) => {
        if (prev.some((p) => p.peerId === peerId)) {
          console.log("ℹ️ Participant already exists:", peerId);
          return prev;
        }
        console.log("➕ Adding new participant:", peerId, "with name:", displayName);
        return [
          ...prev,
          {
            peerId,
            stream: remoteStream,
            userId: participantUserId,
            displayName,
          },
        ];
      });
    });

    call.on("close", () => {
      console.log("❌ Call closed with:", peerId);
      setParticipants((prev) => prev.filter((p) => p.peerId !== peerId));
    });

    connectionsRef.current.set(peerId, call);
  };

  const callPeer = (peerId: string) => {
    console.log("📱 Attempting to call peer:", peerId);
    
    if (!isPeerReady) {
      console.log("⏳ Peer not ready yet, adding to pending calls:", peerId);
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
      setIsScreenSharing(true);

      // Replace video track for all connections
      const videoTrack = screenStream.getVideoTracks()[0];
      connectionsRef.current.forEach((call) => {
        const sender = call.peerConnection
          .getSenders()
          .find((s) => s.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });

      // When screen sharing stops
      videoTrack.onended = () => {
        stopScreenShare();
      };

    } catch (error) {
      console.error("Error starting screen share:", error);
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current && localStream) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      
      // Replace back to camera
      const videoTrack = localStream.getVideoTracks()[0];
      connectionsRef.current.forEach((call) => {
        const sender = call.peerConnection
          .getSenders()
          .find((s) => s.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });

      screenStreamRef.current = null;
      setIsScreenSharing(false);
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
  };
};

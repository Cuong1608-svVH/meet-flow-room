import Peer, { MediaConnection } from "peerjs";
import { useEffect, useRef, useState } from "react";

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
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, MediaConnection>>(new Map());
  const screenStreamRef = useRef<MediaStream | null>(null);

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
          console.log("My peer ID is: " + id);
        });

        peer.on("call", (call) => {
          // Answer the call with local stream
          call.answer(stream);
          
          call.on("stream", (remoteStream) => {
            // Add remote participant
            setParticipants((prev) => {
              // Check if participant already exists
              if (prev.some((p) => p.peerId === call.peer)) {
                return prev;
              }
              return [
                ...prev,
                {
                  peerId: call.peer,
                  stream: remoteStream,
                  userId: call.peer.split("-")[1] || "",
                  displayName: "User",
                },
              ];
            });
          });

          call.on("close", () => {
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

  const callPeer = (peerId: string) => {
    if (!localStream || !peerRef.current) return;

    const call = peerRef.current.call(peerId, localStream);
    
    call.on("stream", (remoteStream) => {
      setParticipants((prev) => {
        if (prev.some((p) => p.peerId === peerId)) {
          return prev;
        }
        return [
          ...prev,
          {
            peerId,
            stream: remoteStream,
            userId: peerId.split("-")[1] || "",
            displayName: "User",
          },
        ];
      });
    });

    call.on("close", () => {
      setParticipants((prev) => prev.filter((p) => p.peerId !== peerId));
    });

    connectionsRef.current.set(peerId, call);
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
    toggleVideo,
    toggleAudio,
    startScreenShare,
    stopScreenShare,
    callPeer,
    myPeerId: peerRef.current?.id,
  };
};

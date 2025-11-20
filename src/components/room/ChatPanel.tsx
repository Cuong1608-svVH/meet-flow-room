import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  display_name?: string;
}

interface ChatPanelProps {
  roomId: string;
}

export const ChatPanel = ({ roomId }: ChatPanelProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load existing messages
    const loadMessages = async () => {
      const { data: messagesData } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (messagesData) {
        // Fetch profiles for all messages
        const userIds = [...new Set(messagesData.map(m => m.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds);

        const profilesMap = new Map(
          profilesData?.map(p => [p.id, p.display_name]) || []
        );

        const enrichedMessages = messagesData.map(msg => ({
          ...msg,
          display_name: profilesMap.get(msg.user_id) || "User",
        }));

        setMessages(enrichedMessages);
      }
    };

    loadMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          // Fetch the profile info for the new message
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", payload.new.user_id)
            .single();

          setMessages((prev) => [
            ...prev,
            {
              ...payload.new,
              display_name: profile?.display_name || "User",
            } as Message,
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    // Auto-scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    await supabase.from("messages").insert({
      room_id: roomId,
      user_id: user.id,
      content: newMessage,
    });

    setNewMessage("");
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold">Tin nhắn</h3>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-3">
          {messages.map((message) => (
            <div key={message.id} className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-sm">
                  {message.display_name || "User"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(message.created_at).toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-sm text-foreground">{message.content}</p>
            </div>
          ))}
        </div>
      </ScrollArea>

      <form onSubmit={sendMessage} className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Nhập tin nhắn..."
            className="flex-1"
          />
          <Button type="submit" size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

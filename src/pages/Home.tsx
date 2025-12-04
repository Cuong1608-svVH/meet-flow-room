import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Video, Plus, LogOut } from "lucide-react";
import { ChangePasswordDialog } from "@/components/auth/ChangePasswordDialog";
import { AvatarUploadDialog } from "@/components/auth/AvatarUploadDialog";

const Home = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [roomId, setRoomId] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 10);
  };

  const createRoom = async () => {
    setIsCreating(true);
    const newRoomId = generateRoomId();
    
    const { error } = await supabase
      .from("rooms")
      .insert({
        id: newRoomId,
        created_by: user?.id,
      });

    if (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tạo phòng họp",
        variant: "destructive",
      });
      setIsCreating(false);
      return;
    }

    navigate(`/room/${newRoomId}`);
    setIsCreating(false);
  };

  const joinRoom = () => {
    if (!roomId.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập mã phòng",
        variant: "destructive",
      });
      return;
    }
    navigate(`/room/${roomId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary rounded-lg">
              <Video className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold">Video Meeting</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <AvatarUploadDialog />
              <span className="text-sm text-muted-foreground">
                {profile?.display_name || user?.email}
              </span>
            </div>
            <ChangePasswordDialog />
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Đăng xuất
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Họp video chất lượng cao</h1>
            <p className="text-lg text-muted-foreground">
              Tạo hoặc tham gia phòng họp ngay bây giờ
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Tạo phòng họp mới
                </CardTitle>
                <CardDescription>
                  Bắt đầu cuộc họp mới với mã phòng ngẫu nhiên
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={createRoom}
                  disabled={isCreating}
                  className="w-full"
                  size="lg"
                >
                  {isCreating ? "Đang tạo..." : "Tạo phòng mới"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Tham gia phòng họp
                </CardTitle>
                <CardDescription>
                  Nhập mã phòng để tham gia cuộc họp
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Nhập mã phòng (vd: abc123)"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && joinRoom()}
                />
                <Button
                  onClick={joinRoom}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  Tham gia
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;

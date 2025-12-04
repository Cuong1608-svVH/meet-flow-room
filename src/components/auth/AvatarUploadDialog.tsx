import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Camera, Upload, Loader2 } from "lucide-react";

export const AvatarUploadDialog = () => {
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user, profile, fetchProfile } = useAuth();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Lỗi",
        description: "Chỉ chấp nhận file JPG, PNG hoặc WEBP",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Lỗi",
        description: "Kích thước file tối đa là 2MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    setIsUploading(true);

    try {
      const fileExt = selectedFile.name.split(".").pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Delete old avatar if exists
      await supabase.storage.from("avatars").remove([`${user.id}/avatar.jpg`, `${user.id}/avatar.png`, `${user.id}/avatar.webp`]);

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, selectedFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Update profile with new avatar URL (add timestamp to bust cache)
      const avatarUrlWithTimestamp = `${publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrlWithTimestamp })
        .eq("id", user.id);

      if (updateError) throw updateError;

      await fetchProfile();

      toast({
        title: "Thành công",
        description: "Ảnh đại diện đã được cập nhật",
      });

      setOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tải lên ảnh đại diện",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const displayName = profile?.display_name || user?.email || "User";
  const currentAvatarUrl = previewUrl || profile?.avatar_url;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="relative group">
          <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-transparent hover:ring-primary transition-all">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="h-3 w-3 text-white" />
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Thay đổi ảnh đại diện
          </DialogTitle>
          <DialogDescription>
            Chọn ảnh mới cho tài khoản của bạn
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          <Avatar className="h-32 w-32">
            <AvatarImage src={currentAvatarUrl || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-3xl">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />

          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            Chọn ảnh từ máy tính
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Định dạng: JPG, PNG, WEBP<br />
            Kích thước tối đa: 2MB
          </p>

          {selectedFile && (
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang tải lên...
                </>
              ) : (
                "Lưu thay đổi"
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

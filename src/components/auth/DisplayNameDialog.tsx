import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Pencil } from "lucide-react";

export const DisplayNameDialog = () => {
  const { user, profile, fetchProfile } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setDisplayName(profile?.display_name || "");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = displayName.trim();
    
    if (!trimmedName) {
      toast({
        title: "Lỗi",
        description: "Tên hiển thị không được để trống",
        variant: "destructive",
      });
      return;
    }

    if (trimmedName.length > 50) {
      toast({
        title: "Lỗi",
        description: "Tên hiển thị không được quá 50 ký tự",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: trimmedName })
      .eq("id", user?.id);

    if (error) {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật tên hiển thị",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    await fetchProfile();
    
    toast({
      title: "Thành công",
      description: "Đã cập nhật tên hiển thị",
    });
    
    setIsLoading(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors group">
          <span>{profile?.display_name || user?.email}</span>
          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Đổi tên hiển thị</DialogTitle>
          <DialogDescription>
            Nhập tên mới bạn muốn hiển thị trong cuộc họp
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Tên hiển thị</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nhập tên hiển thị"
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              {displayName.length}/50 ký tự
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

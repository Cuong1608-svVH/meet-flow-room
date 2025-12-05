import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile } from "lucide-react";
import { useState } from "react";

const EMOJIS = ["👍", "❤️", "😂", "😮", "👏", "🎉"];

interface EmojiReactionPickerProps {
  onSelectEmoji: (emoji: string) => void;
}

export const EmojiReactionPicker = ({ onSelectEmoji }: EmojiReactionPickerProps) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (emoji: string) => {
    onSelectEmoji(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 rounded-full bg-muted hover:bg-muted/80 text-foreground"
          title="Gửi biểu cảm"
        >
          <Smile className="h-6 w-6" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2 bg-popover border border-border" side="top" sideOffset={12}>
        <div className="flex gap-1">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleSelect(emoji)}
              className="text-2xl p-2 hover:bg-accent rounded-lg transition-transform hover:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

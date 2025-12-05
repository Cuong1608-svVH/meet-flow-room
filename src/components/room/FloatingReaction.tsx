import { useEffect, useState } from "react";

interface FloatingReactionProps {
  emoji: string;
  id: string;
  onComplete: (id: string) => void;
}

export const FloatingReaction = ({ emoji, id, onComplete }: FloatingReactionProps) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete(id);
    }, 3000);

    return () => clearTimeout(timer);
  }, [id, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 animate-float-up pointer-events-none">
      <span className="text-5xl drop-shadow-lg">{emoji}</span>
    </div>
  );
};

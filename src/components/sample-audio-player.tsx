"use client";

import { useRef, useState } from "react";

interface SampleAudioPlayerProps {
  src: string;
  className?: string;
  maxSeconds?: number;
  caption?: string;
}

export default function SampleAudioPlayer({
  src,
  className,
  maxSeconds = 20,
  caption,
}: SampleAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [message, setMessage] = useState(caption || `Sample preview capped at ${maxSeconds} seconds.`);

  function stopAtLimit() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (audio.currentTime >= maxSeconds) {
      audio.pause();
      audio.currentTime = 0;
      setMessage(`Sample stopped at ${maxSeconds} seconds for preview security.`);
    }
  }

  function handleSeeking() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (audio.currentTime > maxSeconds) {
      audio.currentTime = 0;
      audio.pause();
      setMessage(`Preview access is limited to the first ${maxSeconds} seconds.`);
    }
  }

  return (
    <div className="sample-player-shell" onContextMenu={(event) => event.preventDefault()}>
      <audio
        ref={audioRef}
        controls
        preload="metadata"
        src={src}
        className={className}
        controlsList="nodownload noplaybackrate noremoteplayback"
        onTimeUpdate={stopAtLimit}
        onSeeking={handleSeeking}
      />
      <p className="sample-player-note">{message}</p>
    </div>
  );
}

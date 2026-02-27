// frontend/src/components/Twinny.tsx
import { useEffect, useState } from "react";

export default function Twinny({ size = 280 }: { size?: number }) {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    // Preload closed-eye image to prevent flicker on first blink
    const preload = new Image();
    preload.src = "/assets/twinny/twinny_closed.png";

    let closeTimer: ReturnType<typeof setTimeout>;
    const interval = setInterval(() => {
      setBlink(true);
      closeTimer = setTimeout(() => setBlink(false), 150);
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(closeTimer);
    };
  }, []);

  return (
    <div style={{ width: size, height: size, flexShrink: 0 }}>
      <img
        src={blink
          ? "/assets/twinny/twinny_closed.png"
          : "/assets/twinny/twinny_open.png"}
        alt="Twinny"
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />
    </div>
  );
}
import { useEffect, useState } from "react";
import { HKWLoader } from "./HKWLoader";

export function HkTubeWelcomeLoader() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const exitTimer = window.setTimeout(() => setLeaving(true), 1250);
    const hideTimer = window.setTimeout(() => setVisible(false), 1700);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;
  return <div className={leaving ? "hkw-startup-leaving" : "hkw-startup-entering"}><HKWLoader fullscreen label="Loading HKW" /></div>;
}

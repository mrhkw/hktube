import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;
  return <div role="status" aria-live="polite" className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-rose-600 px-4 py-1.5 text-center text-xs font-semibold text-white shadow-md"><WifiOff className="size-3.5" />You are currently offline. Please check your internet connection.</div>;
}

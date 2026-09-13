import { useLocation } from "wouter";
import { AdSenseAd } from "./AdSenseAd";

export function GlobalAdPlacement() {
  const [location] = useLocation();
  if (location !== "/" && location !== "/home" && location !== "/trending" && !location.startsWith("/watch/")) return null;
  return <AdSenseAd />;
}

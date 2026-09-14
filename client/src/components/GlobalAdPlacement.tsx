import { useLocation } from "wouter";
import { AdSenseAd } from "./AdSenseAd";

export function GlobalAdPlacement() {
  const [location] = useLocation();
  if (location !== "/" && location !== "/home" && location !== "/trending" && !location.startsWith("/watch/")) return null;

  // Keep the mobile experience clean. Ads remain available on larger screens,
  // while the compact phone layout has no large blank advertisement block.
  return <div className="hidden md:block"><AdSenseAd /></div>;
}

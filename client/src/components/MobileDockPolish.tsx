import { useEffect } from "react";
import { useLocation } from "wouter";

export function MobileDockPolish() {
  const [, navigate] = useLocation();
  useEffect(() => {
    const timer = window.setInterval(() => {
      const dock = document.querySelector('nav.fixed[aria-label="Mobile navigation"]');
      const last = dock?.lastElementChild;
      const label = last?.querySelector("span:last-child");
      if (!last || !label) return;
      label.textContent = "Profile";
      last.setAttribute("aria-label", "Profile");
      if (last.getAttribute("data-profile-dock") !== "true") {
        last.setAttribute("data-profile-dock", "true");
        last.addEventListener("click", event => { event.preventDefault(); event.stopImmediatePropagation(); navigate("/profile"); }, true);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [navigate]);
  return <style>{`@media(max-width:767px){nav.fixed[aria-label="Mobile navigation"]>a svg,nav.fixed[aria-label="Mobile navigation"]>button svg{width:18px!important;height:18px!important}nav.fixed[aria-label="Mobile navigation"]>a,nav.fixed[aria-label="Mobile navigation"]>button{min-height:52px!important;justify-content:flex-start!important;padding-top:4px!important;padding-bottom:3px!important}nav.fixed[aria-label="Mobile navigation"]>button[data-profile-dock="true"] span:last-child{font-size:10px!important;line-height:14px!important}}`}</style>;
}

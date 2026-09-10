import { useEffect } from "react";
import { useLocation } from "wouter";

export function MobileDockPolish() {
  const [, navigate] = useLocation();
  useEffect(() => {
    const sync = () => {
      const dock = document.querySelector('nav.fixed[aria-label="Mobile navigation"]');
      if (!dock) return;
      const items = dock.querySelectorAll<HTMLElement>("a,button");
      const profile = items.item(items.length - 1);
      if (!profile) return;
      profile.setAttribute("aria-label", "Profile");
      profile.setAttribute("data-profile-dock", "true");
      const label = profile.querySelector("span:last-child");
      if (label) label.textContent = "Profile";
      profile.onclick = event => { event.preventDefault(); event.stopPropagation(); navigate("/profile"); };
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [navigate]);
  return <style>{`@media(max-width:767px){nav.fixed[aria-label="Mobile navigation"]{height:calc(68px + env(safe-area-inset-bottom));min-height:68px;padding-bottom:env(safe-area-inset-bottom)!important;bottom:0!important;position:fixed!important;transform:none!important;display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr));align-items:stretch!important}nav.fixed[aria-label="Mobile navigation"]>a,nav.fixed[aria-label="Mobile navigation"]>button{height:68px!important;min-height:68px!important;padding:8px 2px 6px!important;justify-content:center!important;transform:none!important;display:flex!important;flex-direction:column!important;align-items:center!important;gap:3px!important}nav.fixed[aria-label="Mobile navigation"]>a svg,nav.fixed[aria-label="Mobile navigation"]>button svg{width:22px!important;height:22px!important;flex:0 0 22px!important}nav.fixed[aria-label="Mobile navigation"]>a:first-child svg{width:24px!important;height:24px!important;flex-basis:24px!important}nav.fixed[aria-label="Mobile navigation"]>a>span:last-child,nav.fixed[aria-label="Mobile navigation"]>button>span:last-child{font-size:10px!important;line-height:13px!important}nav.fixed[aria-label="Mobile navigation"]>a[data-profile-dock="true"]{cursor:pointer!important}}`}</style>;
}

import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { cn } from "@/lib/utils";
import {
  Bell,
  BookOpen,
  Compass,
  FileText,
  Flame,
  Home,
  Library,
  LogOut,
  MessageCircle,
  MonitorPlay,
  Plus,
  Search,
  Settings2,
  Sparkles,
  UserRound,
  Video,
  HelpCircle,
  Camera,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { HkTubeCreateGallery, type CreateMediaMode } from "@/components/HkTubeCreateGallery";
import { setPendingCreateMedia } from "@/lib/pendingCreateMedia";

type HkTubeShellProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  immersive?: boolean;
  minimalHeader?: boolean;
  headerAvatarUrl?: string | null;
};
const primaryNav = [
  { label: "Home", href: "/", icon: Home },
  { label: "Explore", href: "/explore", icon: Compass },
  { label: "Clips", href: "/clips", icon: MonitorPlay },
  { label: "Posts", href: "/posts", icon: Sparkles },
  { label: "Trending", href: "/trending", icon: Flame },
  { label: "Following", href: "/subscriptions", icon: UserRound },
];
function ProfileGlyph({ className }: { className?: string }) {
  return <UserRound className={className} aria-hidden="true" />;
}
const SHELL_ICON_CLASS = "size-5 shrink-0";

export function HkTubeShell({
  children,
  title,
  subtitle,
  immersive = false,
  minimalHeader = false,
  headerAvatarUrl,
}: HkTubeShellProps) {
  const [location, navigate] = useLocation();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const compactClipsDock = immersive && location.startsWith("/clips");
  const notificationsQuery = trpc.notifications.mine.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 30000,
  });
  const [familyMode, setFamilyMode] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);

  useEffect(() => {
    setFamilyMode(localStorage.getItem("hktube-family-mode") === "enabled");
  }, []);
  useEffect(() => {
    const onOpenCreate = () => openCreate();
    window.addEventListener("hktube-open-create", onOpenCreate);
    return () => window.removeEventListener("hktube-open-create", onOpenCreate);
  }, [isAuthenticated]);
  useEffect(() => {
    if (!location.startsWith("/profile")) setProfileSettingsOpen(false);
  }, [location]);
  useEffect(() => {
    if (!profileSettingsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileSettingsOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [profileSettingsOpen]);
  function openCreate() {
    if (!isAuthenticated) {
      startLogin();
      return;
    }

    setCreateOpen(true);
  }
  function startUpload(category: "regular" | "shorts") {
    setCreateOpen(false);
    const nextMode = category === "shorts" ? "clip" : "video";
    window.dispatchEvent(new CustomEvent("hktube-upload-mode", { detail: nextMode }));
    navigate(category === "shorts" ? "/upload?category=shorts" : "/upload?mode=video");
  }

  const visiblePrimaryNav = familyMode
    ? primaryNav.filter(item => item.href !== "/clips")
    : primaryNav;
  const unread =
    notificationsQuery.data?.filter(item => !item.readAt).length ?? 0;
  const usesPrimaryNavigation = [
    "/",
    "/home",
    "/index.html",
    "/app",
    "/upload",
    "/library",
    "/profile",
  ].includes(location);
  const referenceHeader = usesPrimaryNavigation;

  return (
    <div
      className={cn(
        immersive
          ? "flex h-[100dvh] flex-col overflow-hidden bg-[#090c14] text-slate-100 selection:bg-violet-500/35"
          : "flex min-h-[100dvh] flex-col bg-[#090c14] text-slate-100 selection:bg-violet-500/35"
        )}
      >
        <header
        className={cn(
          "hktube-reference-header sticky top-0 z-40 border-b border-white/8 bg-[#0d111a]/95 backdrop-blur-xl",
          referenceHeader &&
            "max-md:border-black/10 max-md:bg-white max-md:text-neutral-950",
          immersive && "max-lg:hidden"
        )}
        >
          <div className="flex h-14 items-center gap-2 px-3 sm:px-5 lg:h-16 lg:px-7">
            {location === "/" && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="group grid size-10 shrink-0 place-items-center rounded-full text-neutral-950 transition hover:bg-black/[.06] active:scale-95"
                aria-label="Open HkTube menu"
              >
                <span className="grid w-6 gap-[4px]" aria-hidden="true">
                  <span className="h-[2.5px] w-6 rounded-full bg-neutral-950 transition-transform group-hover:translate-x-[1px]" />
                  <span className="h-[2.5px] w-6 rounded-full bg-neutral-950 transition-transform group-hover:-translate-x-[1px]" />
                  <span className="h-[2.5px] w-6 rounded-full bg-neutral-950 transition-transform group-hover:translate-x-[1px]" />
                </span>
              </button>
            )}
            <Link
              href="/"
              className="hktube-reference-logo flex min-w-0 shrink-0 items-center"
                aria-label="Go to HKW homepage"
            >
              <img src="/brand/hkw-mark.webp" alt="HKW" className="size-8 rounded-lg object-cover shadow-sm" />
              <span className="ml-2 whitespace-nowrap text-[20px] font-black tracking-[-.045em] text-neutral-950">HKW</span>
            </Link>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <Link
              href="/notifications"
              className="hktube-header-action hktube-notification-action relative grid size-11 place-items-center rounded-full text-slate-700 transition hover:bg-black/5 hover:text-black md:text-slate-300 md:hover:bg-white/[.07] md:hover:text-white"
              aria-label="Notifications"
            >
              <Bell className={SHELL_ICON_CLASS} strokeWidth={2.35} />
              {unread > 0 && (
                <span className="absolute right-0 top-0 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-black leading-4 text-white">
                  {Math.min(unread, 9)}
                  {unread > 9 ? "+" : ""}
                </span>
                )}
            </Link>
            {location === "/profile" ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileSettingsOpen(value => !value)}
                  className="hktube-header-action grid size-11 place-items-center rounded-full text-neutral-900 transition hover:bg-black/5 md:text-slate-300 md:hover:bg-white/[.07] md:hover:text-white"
                  aria-label="Open profile settings"
                  aria-expanded={profileSettingsOpen}
                  aria-haspopup="menu"
                  title="Settings"
                >
                  <Settings2 className={SHELL_ICON_CLASS} strokeWidth={2.35} />
                </button>
                {profileSettingsOpen && (
                  <div
                    role="menu"
                    aria-label="HkTube settings"
                    className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#151a25] p-2 text-white shadow-2xl shadow-black/30"
                  >
                    <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[.18em] text-violet-300">
                      Account & settings
                    </p>
                    {[
                      ["Notifications", "/notifications"],
                      ["Settings", "/settings"],
                      ["Account security", "/settings/security"],
                    ].map(([label, href]) => (
                      <Link
                        key={href}
                        href={href}
                        role="menuitem"
                        onClick={() => setProfileSettingsOpen(false)}
                        className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[.08] hover:text-white"
                      >
                        {label}
                      </Link>
                    ))}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileSettingsOpen(false);
                        void logout();
                      }}
                      className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/[.08] hover:text-white"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/search"
                className="hktube-header-action hktube-search-action grid size-11 place-items-center rounded-full text-neutral-900 hover:bg-black/5 md:text-slate-300 md:hover:bg-white/[.07] md:hover:text-white"
                aria-label="Open search"
              >
                <Search className={SHELL_ICON_CLASS} strokeWidth={2.35} />
              </Link>
            )}
            </div>
          </div>
      </header>

      <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DialogContent className="max-w-sm border-slate-200 bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle>HKW navigation</DialogTitle>
            <DialogDescription>Jump to any part of HKW.</DialogDescription>
          </DialogHeader>
          <nav className="grid gap-1" aria-label="Mobile menu">
            {[
              ["Home", "/"],
              ["Search", "/search"],
              ["Explore", "/explore"],
              ["Clips", "/clips"],
              ["Following", "/subscriptions"],
              ["Library", "/library"],
              ["History", "/history"],
              ["Notifications", "/notifications"],
              ["Profile", isAuthenticated ? "/profile" : "/auth"],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl px-3 py-3 text-sm font-semibold text-slate-800 hover:bg-violet-50"
              >
                {label}
              </Link>
            ))}
          </nav>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="hktube-create-gallery-dialog max-w-4xl overflow-hidden border-white/10 bg-[#0d1019] p-0 text-white shadow-2xl max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[24px]">
          <HkTubeCreateGallery
            onCancel={() => setCreateOpen(false)}
            onSelect={(mode: CreateMediaMode, file: File) => {
              setPendingCreateMedia(mode, file);
              setCreateOpen(false);
              if (mode === "post") navigate("/upload/post");
              else {
                const category = mode === "clip" ? "shorts" : "regular";
                const nextMode = mode === "clip" ? "clip" : "video";
                window.dispatchEvent(new CustomEvent("hktube-upload-mode", { detail: nextMode }));
                navigate(category === "shorts" ? "/upload?category=shorts" : "/upload?mode=video");
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <aside className="fixed inset-y-16 left-0 z-30 hidden w-60 border-r border-white/7 bg-[#0b0f17]/96 px-3 py-5 backdrop-blur-xl md:block">
        <nav className="space-y-1" aria-label="Primary navigation">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">
            Discover
          </p>
          {visiblePrimaryNav.map(item => {
            const active =
              item.href === "/"
                ? location === "/"
                : location.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-violet-500/15 text-white shadow-[inset_2px_0_0_#a78bfa]"
                    : "text-slate-400 hover:bg-white/[.045] hover:text-white"
                )}
              >
                <Icon className={cn("size-5", active && "text-violet-300")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-7 border-t border-white/7 pt-5">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">
            Your space
          </p>
          <Link
            href="/library"
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/[.045] hover:text-white"
          >
            <Library className="size-5" />
            Library
          </Link>
          <Link
            href="/history"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/[.045] hover:text-white"
          >
            <MonitorPlay className="size-5" />
            History
          </Link>
          <Link
            href="/messages"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/[.045] hover:text-white"
          >
            <MessageCircle className="size-5" />
            Messages
          </Link>
          <Link
            href="/notifications"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/[.045] hover:text-white"
          >
            <Bell className="size-5" />
            Notifications
          </Link>
          <Link
            href="/playlists"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/[.045] hover:text-white"
          >
            <BookOpen className="size-5" />
            Playlists
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/[.045] hover:text-white"
          >
            <Settings2 className="size-6" />
            Settings
          </Link>
          <Link
            href="/help"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/[.045] hover:text-white"
          >
            <HelpCircle className="size-5" />
            Help
          </Link>
          {isAuthenticated && (
            <Link
              href="/studio"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/[.045] hover:text-white"
            >
              <Settings2 className="size-5" />
              Creator Studio
            </Link>
          )}
        </div>
        <div className="mt-6 border-t border-white/7 pt-5">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">
            Account
          </p>
          {loading ? (
            <div className="mx-3 h-9 animate-pulse rounded-lg bg-white/8" />
          ) : isAuthenticated ? (
            <>
              <Link
                href="/profile"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/[.045]"
              >
                <span className="grid size-6 place-items-center overflow-hidden rounded-full bg-violet-500/30 text-[10px] font-black">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    (user?.name || "H").slice(0, 1).toUpperCase()
                  )}
                </span>
                {user?.name || "Your profile"}
              </Link>
              <Button
                variant="ghost"
                className="mt-2 w-full justify-start text-slate-400 hover:bg-white/[.045] hover:text-white"
                onClick={() => void logout()}
              >
                <LogOut className="mr-2 size-5" />
                Sign out
              </Button>
            </>
          ) : (
            <Button
              onClick={startLogin}
              className="w-full rounded-xl bg-violet-500 text-sm font-bold text-white hover:bg-violet-400"
            >
              Sign in
            </Button>
          )}
        </div>
      </aside>

      <main
        className={cn(
          "relative flex min-h-[calc(100dvh-58px)] flex-1 flex-col pb-[calc(76px+env(safe-area-inset-bottom))] md:min-h-[calc(100dvh-64px)] md:pb-14 md:pl-60",
          immersive && "max-md:p-0 max-md:pb-0"
        )}
      >
        {(title || subtitle) && (
          <div className="border-b border-white/7 px-5 py-6 sm:px-8 lg:px-10">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1.5 max-w-2xl text-sm text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
        )}
        <div
          className={cn(
            "w-full flex-1 px-0 py-0 sm:px-8 sm:py-6 lg:px-10",
            immersive && "max-lg:p-0"
          )}
        >
          {children}
        </div>
        <footer
          className={cn(
            "hidden border-t border-white/7 px-5 py-7 text-xs text-slate-500 sm:block sm:px-8 lg:px-10",
            immersive && "max-lg:hidden"
          )}
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <p>© {new Date().getFullYear()} HkTube.</p>
            <nav
              className="flex flex-wrap gap-x-4 gap-y-2"
              aria-label="Platform policies"
            >
              <Link href="/privacy" className="hover:text-violet-200">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-violet-200">
                Terms
              </Link>
              <Link href="/cookies" className="hover:text-violet-200">
                Cookies
              </Link>
              <Link href="/community" className="hover:text-violet-200">
                Guidelines
              </Link>
              <Link href="/advertising" className="hover:text-violet-200">
                Advertising
              </Link>
              <Link href="/contact" className="hover:text-violet-200">
                Contact
              </Link>
            </nav>
          </div>
        </footer>
      </main>

      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-[100] grid grid-cols-5 border-t border-white/10 bg-[#0b0d13]/96 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 text-white backdrop-blur-xl md:hidden",
          compactClipsDock && "!h-[60px] !px-2 !pb-[max(0.2rem,env(safe-area-inset-bottom))] !pt-0.5",
          usesPrimaryNavigation && "border-black/10 bg-white text-neutral-950",
          immersive &&
            !location.startsWith("/clips") &&
            !location.startsWith("/shorts") &&
            "max-lg:hidden"
        )}
        aria-label="Mobile navigation"
        data-hktube-navigation-layout={usesPrimaryNavigation ? "primary" : undefined}
      >
        {(compactClipsDock
          ? [
              { label: "Home", href: "/", icon: Home },
              { label: "Clips", href: "/clips", icon: MonitorPlay },
              { label: "Create", href: "#create", icon: Plus },
              { label: "Library", href: "/library", icon: Library },
              {
                label: "Profile",
                href: isAuthenticated ? "/profile" : "/auth",
                icon: ProfileGlyph,
              },
            ]
          : [
              { label: "Home", href: "/", icon: Home },
              { label: "Clips", href: "/clips", icon: MonitorPlay },
              { label: "Create", href: "#create", icon: Plus },
              { label: "Library", href: "/library", icon: Library },
              {
                label: "Profile",
                href: isAuthenticated ? "/profile" : "/auth",
                icon: ProfileGlyph,
              },
            ]
        ).map(item => {
          const active =
            item.href === "/"
              ? location === "/"
              : item.href !== "#create" && location.startsWith(item.href);
          return item.href === "#create" ? (
            <button
              key={item.label}
              type="button"
              onClick={openCreate}
              aria-label="Create content"
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold text-slate-300",
                compactClipsDock && "!min-h-12 !gap-0.5 !text-[9px]"
              )}
            >
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-full bg-red-600 text-white shadow-[0_5px_18px_rgba(220,38,38,.24)]",
                  compactClipsDock && "!size-8",
                  usesPrimaryNavigation &&
                    "rounded-full bg-red-50 text-red-700 shadow-none"
                )}
              >
                <Plus className={cn(SHELL_ICON_CLASS, compactClipsDock && "!size-4")} />
              </span>
            </button>
          ) : (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold",
                compactClipsDock && "!min-h-12 !gap-0.5 !text-[9px]",
                active
                  ? "text-red-700"
                  : usesPrimaryNavigation
                    ? "text-neutral-700"
                    : "text-slate-500"
              )}
            >
              <item.icon
                className={cn(
                  SHELL_ICON_CLASS,
                  compactClipsDock && "!size-4",
                  active && "fill-red-600/10"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

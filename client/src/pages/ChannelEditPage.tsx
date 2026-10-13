import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { ArrowLeft, Camera, Check, Copy, ExternalLink, Loader2, Lock, TriangleAlert } from "lucide-react";
import { HkTubeShell } from "@/components/HkTubeShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { listMySupabaseChannels, updateSupabaseChannel, type SupabaseChannel } from "@/lib/supabaseChannels";
import { uploadProfileImage } from "@/lib/profileMedia";
import {
  channelUrl,
  copyToClipboard,
  isHandleAvailable,
  normalizeHandle,
  readSubscriptionsPrivate,
  saveSubscriptionsPrivate,
  validateHandle,
} from "@/lib/channelIdentity";

type HandleStatus = "idle" | "checking" | "available" | "taken" | "invalid";

/**
 * Edit channel page, reached from the Profile / You tab.
 *
 * Name, handle with a live availability check, the channel URL with a copy
 * button, description, the avatar from the device gallery, and the subscription
 * privacy switch.
 */
export default function ChannelEditPage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const [channel, setChannel] = useState<SupabaseChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState("");
  const [privacyPrivate, setPrivacyPrivate] = useState(false);
  const [privacySynced, setPrivacySynced] = useState(true);
  const [handleStatus, setHandleStatus] = useState<HandleStatus>("idle");
  const [handleMessage, setHandleMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const handleTimer = useRef<number | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      startLogin();
      return;
    }
    void (async () => {
      try {
        const channels = await listMySupabaseChannels();
        const first = channels[0] ?? null;
        setChannel(first);
        if (first) {
          setDisplayName(first.displayName);
          setHandle(first.handle);
          setDescription(first.description ?? "");
          setAvatarUrl(first.avatarUrl);
          setBannerUrl(first.bannerUrl ?? "");
        }
        const privacy = await readSubscriptionsPrivate();
        setPrivacyPrivate(privacy.value);
        setPrivacySynced(privacy.synced);
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "Your channel could not be loaded.");
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, user]);

  useEffect(() => {
    return () => {
      if (handleTimer.current) window.clearTimeout(handleTimer.current);
    };
  }, []);

  /** Checks the handle against the rules, then against the database. */
  const checkHandle = useCallback(
    (value: string) => {
      if (handleTimer.current) window.clearTimeout(handleTimer.current);
      const validation = validateHandle(value);
      if (!validation.ok) {
        setHandleStatus(value.trim() ? "invalid" : "idle");
        setHandleMessage(validation.reason ?? "");
        return;
      }
      if (channel && validation.clean === channel.handle) {
        setHandleStatus("idle");
        setHandleMessage("This is your current handle.");
        return;
      }
      setHandleStatus("checking");
      setHandleMessage("");
      handleTimer.current = window.setTimeout(() => {
        void isHandleAvailable(validation.clean, channel?.id ?? null)
          .then(available => {
            setHandleStatus(available ? "available" : "taken");
            setHandleMessage(available ? `@${validation.clean} is available.` : `@${validation.clean} is already taken.`);
          })
          .catch(() => {
            setHandleStatus("idle");
            setHandleMessage("Could not check availability right now.");
          });
      }, 320);
    },
    [channel]
  );

  async function pickAvatar(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const uploaded = await uploadProfileImage(file);
      setAvatarUrl(uploaded.url);
      toast.success("Logo uploaded. Save your changes to keep it.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "The logo could not be uploaded.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function copyUrl() {
    const url = channelUrl(window.location.origin, handle || channel?.handle || "");
    const ok = await copyToClipboard(url);
    setCopied(ok);
    toast[ok ? "success" : "error"](ok ? "Channel URL copied." : "Copying is blocked in this browser.");
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function save() {
    if (!channel) return;
    const validation = validateHandle(handle);
    if (!validation.ok) {
      toast.error(validation.reason ?? "That handle is not valid.");
      return;
    }
    if (handleStatus === "taken") {
      toast.error("That handle is already taken.");
      return;
    }
    if (!displayName.trim()) {
      toast.error("A channel name is required.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateSupabaseChannel(channel.id, {
        displayName: displayName.trim(),
        description: description.trim(),
        avatarUrl,
        bannerUrl: bannerUrl.trim() || null,
        handle: validation.clean,
      });
      setChannel(updated);
      setHandle(updated.handle);
      const privacy = await saveSubscriptionsPrivate(privacyPrivate);
      setPrivacySynced(privacy.synced);
      toast.success(
        privacy.synced
          ? "Channel updated."
          : "Channel updated. The subscription privacy choice is saved on this device until the privacy column is added."
      );
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Your channel could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const url = channelUrl(window.location.origin, handle || channel?.handle || "");
  const handlePreview = normalizeHandle(handle);

  if (authLoading || loading) {
    return (
      <HkTubeShell title="Edit channel">
        <div className="grid min-h-[50vh] place-items-center">
          <Loader2 className="size-7 animate-spin text-violet-300" />
        </div>
      </HkTubeShell>
    );
  }

  if (!channel) {
    return (
      <HkTubeShell title="Edit channel">
        <main className="mx-auto max-w-xl px-4 pb-16">
          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-6 text-center text-slate-400">
            <p className="font-semibold text-white">No channel yet</p>
            <p className="mt-2 text-sm">Create a channel before editing one.</p>
            <Link
              href="/channel/create"
              className="mt-4 inline-flex items-center rounded-full bg-violet-500 px-4 py-2 text-sm font-bold text-white hover:bg-violet-400"
            >
              Create a channel
            </Link>
          </div>
        </main>
      </HkTubeShell>
    );
  }

  return (
    <HkTubeShell title="Edit channel">
      <main className="mx-auto w-full max-w-2xl px-4 pb-24 sm:px-6">
        <div className="mb-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/profile")}
            aria-label="Back to profile"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[.04] text-white hover:bg-white/[.08]"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-white">Edit channel</h1>
            <p className="text-xs text-slate-400">Your name, handle, picture and privacy</p>
          </div>
        </div>

        {/* Logo -------------------------------------------------------- */}
        <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <span className="grid size-20 place-items-center overflow-hidden rounded-full bg-violet-500/20 text-2xl font-black text-white">
                {avatarUrl ? <img src={avatarUrl} alt="Channel logo" className="size-full object-cover" /> : (displayName || "H").slice(0, 1)}
              </span>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                aria-label="Change channel logo"
                className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full border border-white/15 bg-[#181a20] text-white hover:bg-[#22242c]"
              >
                {uploadingAvatar ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              </button>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white">Picture</p>
              <p className="text-xs text-slate-400">
                Pick a photo from your device gallery. It is stored in the avatars bucket and used across HkTube.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="border-white/12 bg-white/[.04] text-white hover:bg-white/[.08]"
                >
                  <Camera className="mr-2 size-4" />
                  {avatarUrl ? "Change picture" : "Add picture"}
                </Button>
                {avatarUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setAvatarUrl(null)}
                    className="text-slate-300 hover:bg-white/5 hover:text-white"
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={event => {
                void pickAvatar(event.target.files);
                event.target.value = "";
              }}
            />
          </div>
        </section>

        {/* Name, handle, URL ------------------------------------------ */}
        <section className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-white/[.03] p-5">
          <div>
            <label className="text-xs font-bold text-slate-300" htmlFor="hkc-channel-name">
              Name
            </label>
            <Input
              id="hkc-channel-name"
              value={displayName}
              onChange={event => setDisplayName(event.target.value)}
              maxLength={255}
              className="mt-1 border-white/10 bg-black/20 text-white"
              placeholder="Channel name"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              This is the name viewers see on your videos and across HkTube.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300" htmlFor="hkc-channel-handle">
              Handle
            </label>
            <div className="mt-1 flex items-center rounded-md border border-white/10 bg-black/20 px-3">
              <span className="text-slate-400">@</span>
              <input
                id="hkc-channel-handle"
                value={handle}
                onChange={event => {
                  const next = event.target.value;
                  setHandle(next);
                  checkHandle(next);
                }}
                className="h-10 w-full bg-transparent pl-2 text-white outline-none"
                placeholder="yourhandle"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <span className="shrink-0 pl-2 text-xs">
                {handleStatus === "checking" && <Loader2 className="size-4 animate-spin text-slate-400" />}
                {handleStatus === "available" && <Check className="size-4 text-emerald-400" />}
                {handleStatus === "taken" && <TriangleAlert className="size-4 text-amber-400" />}
                {handleStatus === "invalid" && <TriangleAlert className="size-4 text-rose-400" />}
              </span>
            </div>
            {(handleMessage || handlePreview) && (
              <p
                className={
                  "mt-1 text-[11px] " +
                  (handleStatus === "taken" || handleStatus === "invalid"
                    ? "text-rose-300"
                    : handleStatus === "available"
                      ? "text-emerald-300"
                      : "text-slate-500")
                }
              >
                {handleMessage || `Your channel URL will be /channel/${handlePreview}`}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-bold text-slate-300">Channel URL</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border border-white/10 bg-black/25 px-3 py-2.5 text-xs text-slate-300">
                {url}
              </code>
              <Button
                type="button"
                variant="outline"
                onClick={() => void copyUrl()}
                className="shrink-0 border-white/12 bg-white/[.04] text-white hover:bg-white/[.08]"
              >
                {copied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <a
                href={url}
                className="grid size-10 shrink-0 place-items-center rounded-md border border-white/12 bg-white/[.04] text-white hover:bg-white/[.08]"
                aria-label="Open channel page"
              >
                <ExternalLink className="size-4" />
              </a>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300" htmlFor="hkc-channel-description">
              Description
            </label>
            <textarea
              id="hkc-channel-description"
              value={description}
              onChange={event => setDescription(event.target.value)}
              maxLength={5000}
              rows={4}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-violet-300/40"
              placeholder="Tell viewers about your channel"
            />
            <p className="mt-1 text-[11px] text-slate-500">{5000 - description.length} characters left</p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300" htmlFor="hkc-channel-banner">
              Banner image URL (optional)
            </label>
            <Input
              id="hkc-channel-banner"
              value={bannerUrl}
              onChange={event => setBannerUrl(event.target.value)}
              placeholder="https://…"
              className="mt-1 border-white/10 bg-black/20 text-white"
            />
          </div>
        </section>

        {/* Privacy ----------------------------------------------------- */}
        <section className="mt-4 rounded-2xl border border-white/10 bg-white/[.03] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 size-4 text-violet-300" />
              <div>
                <p className="font-bold text-white">Keep all my subscriptions private</p>
                <p className="mt-1 text-xs text-slate-400">
                  When on, the channels you subscribe to stay off your public channel page. Your subscriptions list is
                  always private to you.
                </p>
              </div>
            </div>
            <Switch
              checked={privacyPrivate}
              onCheckedChange={value => setPrivacyPrivate(value)}
              aria-label="Keep all my subscriptions private"
            />
          </div>
          {!privacySynced && (
            <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-400/10 p-3 text-[11px] text-amber-100">
              The account column for this setting does not exist yet, so the choice is stored on this device. Applying
              supabase/migrations/20261013090000_community_posts_multi_image_schedule.sql syncs it to your account.
            </p>
          )}
        </section>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/profile")}
            className="border-white/12 bg-white/[.04] text-white hover:bg-white/[.08]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void save()}
            disabled={saving || handleStatus === "taken" || handleStatus === "invalid"}
            className="bg-violet-500 font-bold text-white hover:bg-violet-400"
          >
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      </main>
    </HkTubeShell>
  );
}

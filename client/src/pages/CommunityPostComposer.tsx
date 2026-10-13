import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarClock,
  Globe,
  Images,
  Loader2,
  Lock,
  Music2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import {
  describePostTiming,
  insertCommunityPost,
  MAX_POST_IMAGES,
  normalizeIsoOrNull,
  postImageUrl,
  runPostMaintenance,
  uploadPostImages,
  type PostVisibility,
} from "@/lib/communityPosts";
import { loadSoundAsBlob, soundLabel, type PlatformSound } from "@/lib/musicLibrary";
import SoundLibrarySheet from "@/components/create/SoundLibrarySheet";
import GalleryStage from "@/components/create/GalleryStage";
import DiscardDialog from "@/components/create/DiscardDialog";
import "@/styles/create.css";

type PickedImage = { id: string; file: File; previewUrl: string };

/**
 * The "+ → Post" composer, laid out like a YouTube community post: visibility at
 * the top, an optional sound, the text box, up to ten images, then schedule and
 * expiration behind the publish button.
 */
export default function CommunityPostComposer() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const [body, setBody] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [visibility, setVisibility] = useState<PostVisibility>("public");
  const [sound, setSound] = useState<{ title: string; url: string } | null>(null);
  const [soundSheetOpen, setSoundSheetOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledFor, setScheduledFor] = useState("");
  const [expirationMode, setExpirationMode] = useState<"never" | "date">("never");
  const [expiresAt, setExpiresAt] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [phase, setPhase] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const soundInputRef = useRef<HTMLInputElement | null>(null);
  const soundAudioRef = useRef<HTMLAudioElement | null>(null);

  const dirty = Boolean(body.trim() || images.length > 0 || sound);

  useEffect(() => {
    if (authLoading) return;
    if (!user) startLogin();
  }, [authLoading, user]);

  // Publishing happens from this page, so a half-written post must not vanish.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    return () => {
      soundAudioRef.current?.pause();
    };
  }, []);

  // Object URLs for the picked images are owned here and always revoked.
  useEffect(() => {
    return () => {
      setImages(current => {
        for (const image of current) URL.revokeObjectURL(image.previewUrl);
        return [];
      });
    };
  }, []);

  const addFiles = useCallback((files: FileList | File[] | null) => {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    setImages(current => {
      const room = MAX_POST_IMAGES - current.length;
      if (room <= 0) {
        toast.error(`A post can carry up to ${MAX_POST_IMAGES} images.`);
        return current;
      }
      if (list.length > room) {
        toast.info(`Only ${room} more image(s) fit; the rest were skipped.`);
      }
      const next = list.slice(0, room).map(file => ({
        id: `post-image-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return [...current, ...next];
    });
  }, []);

  function removeImage(id: string) {
    setImages(current => {
      const target = current.find(image => image.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter(image => image.id !== id);
    });
  }

  async function usePlatformSound(picked: PlatformSound, url: string) {
    setSound({ title: soundLabel(picked), url });
    setSoundSheetOpen(false);
    // Confirm it is audible instead of assuming the mix will work later.
    const audio = soundAudioRef.current;
    if (audio) {
      audio.src = url;
      audio.currentTime = 0;
      try {
        await audio.play();
      } catch {
        toast.warning("The sound was added, but this browser blocked the preview until you tap play.");
      }
    }
  }

  async function pickSoundFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      toast.error("Choose an audio file.");
      return;
    }
    setSound({ title: file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Added sound", url: URL.createObjectURL(file) });
  }

  const scheduleIso = useMemo(
    () => (scheduleMode === "later" ? normalizeIsoOrNull(scheduledFor) : null),
    [scheduleMode, scheduledFor]
  );
  const expiryIso = useMemo(
    () => (expirationMode === "date" ? normalizeIsoOrNull(expiresAt) : null),
    [expirationMode, expiresAt]
  );

  const canPublish = Boolean(body.trim() || images.length > 0) && !publishing;

  async function publish() {
    if (!user || !canPublish) return;
    if (scheduleMode === "later" && !scheduleIso) {
      toast.error("Choose the date and time this post should go live.");
      return;
    }
    if (expirationMode === "date" && !expiryIso) {
      toast.error("Choose the date this post should expire, or turn expiration off.");
      return;
    }
    setPublishing(true);
    try {
      setPhase("Uploading images…");
      const upload = await uploadPostImages(
        images.map(image => image.file),
        user.id
      );
      if (upload.failed.length > 0) {
        toast.error(`${upload.failed.length} image(s) could not be uploaded: ${upload.failed[0].reason}`);
        if (upload.paths.length === 0 && !body.trim()) return;
      }

      setPhase("Saving post…");
      const result = await insertCommunityPost(
        {
          body: body.trim(),
          imagePaths: upload.paths,
          visibility,
          scheduledFor: scheduleIso,
          expiresAt: expiryIso,
        },
        { authorId: user.id }
      );

      // A scheduled post publishes when the app next runs the maintenance sweep.
      if (scheduleIso && new Date(scheduleIso).getTime() <= Date.now()) {
        await runPostMaintenance(user.id);
      }

      for (const note of result.notes) toast.info(note);
      toast.success(
        scheduleIso ? `Post scheduled. ${describePostTiming({ body: "", imagePaths: [], visibility, scheduledFor: scheduleIso, expiresAt: expiryIso })}` : "Post published"
      );
      navigate("/posts");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "The post could not be published.");
    } finally {
      setPhase("");
      setPublishing(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="hkc-root">
        <div className="grid min-h-[60vh] place-items-center">
          <Loader2 className="size-7 animate-spin text-fuchsia-300" />
        </div>
      </div>
    );
  }

  if (libraryOpen) {
    return (
      <div className="hkc-root">
        <header className="hkc-top">
          <button type="button" className="hkc-icon-btn" onClick={() => setLibraryOpen(false)} aria-label="Back">
            <ArrowLeft />
          </button>
          <span className="hkc-title">Select images</span>
          <span style={{ width: 40 }} />
        </header>
        <GalleryStage
          photosOnly
          onPicked={() => {
            toast.info("Video cannot go in a post. Use + → Upload a Short or Upload a video for video.");
          }}
          onPhotoPicked={entry => {
            const file = new File([entry.blob], entry.name, { type: entry.mimeType || "image/jpeg" });
            addFiles([file]);
            setLibraryOpen(false);
          }}
          onCancel={() => setLibraryOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="hkc-root">
      <header className="hkc-top">
        <button
          type="button"
          className="hkc-icon-btn"
          onClick={() => (dirty ? setDiscardOpen(true) : navigate("/"))}
          aria-label="Close post composer"
        >
          <X />
        </button>
        <span className="hkc-title">Create post</span>
        <button
          type="button"
          className="hkc-pill"
          disabled={!canPublish}
          onClick={() => void publish()}
        >
          {publishing ? <Loader2 className="size-4 animate-spin" /> : null}
          {scheduleMode === "later" ? "Schedule" : "Publish"}
        </button>
      </header>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 16px 24px" }}>
        {/* Visibility ---------------------------------------------------- */}
        <div className="hkc-row">
          <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
            {visibility === "public" ? <Globe className="size-4" /> : <Lock className="size-4" />}
            <span>
              <p className="hkc-row-label" style={{ fontSize: 13 }}>
                Visibility
              </p>
              <p className="hkc-row-hint">Who can see this post</p>
            </span>
          </span>
          <select
            className="hkc-field"
            style={{ width: 140 }}
            value={visibility}
            onChange={event => setVisibility(event.target.value as PostVisibility)}
            aria-label="Post visibility"
          >
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>
        </div>

        {/* Sound --------------------------------------------------------- */}
        <div className="hkc-row" style={{ marginTop: 10 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
            <Music2 className="size-4 shrink-0" />
            <span style={{ minWidth: 0 }}>
              <p className="hkc-row-label" style={{ fontSize: 13 }}>
                Add sound
              </p>
              <p
                className="hkc-row-hint"
                style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {sound ? sound.title : "Optional. Plays while someone watches this post."}
              </p>
            </span>
          </span>
          <span style={{ display: "flex", gap: 6 }}>
            {sound && (
              <button type="button" className="hkc-icon-btn" onClick={() => setSound(null)} aria-label="Remove sound">
                <Trash2 className="size-4" />
              </button>
            )}
            <button type="button" className="hkc-pill hkc-pill--ghost" onClick={() => soundInputRef.current?.click()}>
              Import
            </button>
            <button type="button" className="hkc-pill hkc-pill--ghost" onClick={() => setSoundSheetOpen(true)}>
              {sound ? "Change" : "Add"}
            </button>
          </span>
        </div>
        <input
          ref={soundInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={event => {
            void pickSoundFile(event.target.files);
            event.target.value = "";
          }}
        />
        {sound && <audio ref={soundAudioRef} src={sound.url} controls className="hkc-post-audio" />}

        {/* Text ---------------------------------------------------------- */}
        <textarea
          className="hkc-field"
          style={{ width: "100%", marginTop: 12, minHeight: 120 }}
          maxLength={5000}
          placeholder="Say something…"
          value={body}
          onChange={event => setBody(event.target.value)}
        />
        <p className="hkc-row-hint" style={{ textAlign: "right" }}>
          {Math.max(0, 5000 - body.length)} characters left
        </p>

        {/* Images -------------------------------------------------------- */}
        <p className="hkc-row-label" style={{ marginTop: 8 }}>
          Images
        </p>
        <p className="hkc-row-hint">
          {images.length}/{MAX_POST_IMAGES} selected. They appear as a carousel on the post.
        </p>
        <div className="hkc-media-grid" style={{ marginTop: 8 }}>
          {images.map(image => (
            <div key={image.id} className="hkc-media-cell" style={{ cursor: "default" }}>
              <img src={image.previewUrl} alt="" />
              <button
                type="button"
                className="hkc-media-order"
                style={{ top: 4, left: 4, right: "auto" }}
                aria-label="Remove image"
                onClick={() => removeImage(image.id)}
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
          {images.length < MAX_POST_IMAGES && (
            <button
              type="button"
              className="hkc-media-cell"
              style={{ display: "grid", placeItems: "center", border: "1px dashed rgba(255,255,255,.25)" }}
              onClick={() => fileInputRef.current?.click()}
            >
              <span style={{ display: "grid", placeItems: "center", gap: 4, fontSize: 11, color: "rgba(255,255,255,.75)" }}>
                <Plus className="size-5" />
                Select images
              </span>
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button type="button" className="hkc-pill hkc-pill--ghost" onClick={() => fileInputRef.current?.click()}>
            <Images className="size-4" /> Select images
          </button>
          <button type="button" className="hkc-pill hkc-pill--ghost" onClick={() => setLibraryOpen(true)}>
            From your library
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={event => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />

        {/* Schedule and expiration -------------------------------------- */}
        <div className="hkc-row" style={{ marginTop: 16 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <CalendarClock className="size-4" />
            <span>
              <p className="hkc-row-label" style={{ fontSize: 13 }}>
                Schedule
              </p>
              <p className="hkc-row-hint">Publish now, or pick a time</p>
            </span>
          </span>
          <select
            className="hkc-field"
            style={{ width: 150 }}
            value={scheduleMode}
            onChange={event => setScheduleMode(event.target.value as "now" | "later")}
            aria-label="Schedule"
          >
            <option value="now">Publish now</option>
            <option value="later">Schedule</option>
          </select>
        </div>
        {scheduleMode === "later" && (
          <>
            <input
              type="datetime-local"
              className="hkc-field"
              style={{ width: "100%", marginTop: 8 }}
              value={scheduledFor}
              onChange={event => setScheduledFor(event.target.value)}
              aria-label="Scheduled time"
            />
            <p className="hkc-row-hint">
              HkTube has no server worker for posts yet, so a scheduled post goes live the next time the app is
              open after its time. Videos use the platform&apos;s own scheduler.
            </p>
          </>
        )}

        <div className="hkc-row" style={{ marginTop: 12 }}>
          <span>
            <p className="hkc-row-label" style={{ fontSize: 13 }}>
              Expiration
            </p>
            <p className="hkc-row-hint">Stop showing this post after a date</p>
          </span>
          <select
            className="hkc-field"
            style={{ width: 150 }}
            value={expirationMode}
            onChange={event => setExpirationMode(event.target.value as "never" | "date")}
            aria-label="Expiration"
          >
            <option value="never">No expiration</option>
            <option value="date">Expire on a date</option>
          </select>
        </div>
        {expirationMode === "date" && (
          <input
            type="datetime-local"
            className="hkc-field"
            style={{ width: "100%", marginTop: 8 }}
            value={expiresAt}
            onChange={event => setExpiresAt(event.target.value)}
            aria-label="Expiration date"
          />
        )}

        <p className="hkc-note" style={{ marginTop: 14 }}>
          HkTube stores post images in the same bucket the feed already serves, so a published post shows up in
          the Posts feed straight away.
        </p>
      </div>

      <div
        style={{
          flex: "0 0 auto",
          padding: "12px 16px max(16px, env(safe-area-inset-bottom))",
          borderTop: "1px solid rgb(255 255 255 / 8%)",
          background: "#0f0f0f",
        }}
      >
        {publishing && (
          <p className="hkc-row-hint" style={{ marginBottom: 8, textAlign: "center" }}>
            {phase || "Publishing…"}
          </p>
        )}
        <button
          type="button"
          className="hkc-pill"
          style={{ width: "100%", minHeight: 46, justifyContent: "center" }}
          disabled={!canPublish}
          onClick={() => void publish()}
        >
          {publishing ? "Publishing…" : scheduleMode === "later" ? "Schedule post" : "Publish post"}
        </button>
        {!canPublish && !publishing && (
          <p className="hkc-row-hint" style={{ marginTop: 8, textAlign: "center" }}>
            Write something or select an image to publish.
          </p>
        )}
      </div>

      <SoundLibrarySheet
        open={soundSheetOpen}
        onClose={() => setSoundSheetOpen(false)}
        onUse={(picked, url) => void usePlatformSound(picked, url)}
      />

      <DiscardDialog
        open={discardOpen}
        onCancel={() => setDiscardOpen(false)}
        onDiscard={() => {
          setDiscardOpen(false);
          navigate("/");
        }}
      />

    </div>
  );
}

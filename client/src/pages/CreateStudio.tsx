import { ArrowLeft, Images, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { HkTubeShell } from "@/components/HkTubeShell";
import { supabase } from "@/lib/supabase";
import { createSupabaseVideo } from "@/lib/supabaseVideos";
import { trpc } from "@/lib/trpc";
import {
  captureEditedFrame,
  clampTrim,
  exportEditedVideo,
  isRecordingSupported,
  mediaDuration,
  needsReEncode,
  needsReframe,
  type AddedAudio,
  type EffectId,
  type FilterId,
  type Overlay,
  type TrimRange,
  type Voiceover,
} from "@/lib/videoEditor";
import CameraStage, { type CameraClip } from "@/components/create/CameraStage";
import GalleryStage from "@/components/create/GalleryStage";
import PostStage from "@/components/create/PostStage";
import type { MediaEntry } from "@/lib/mediaLibrary";
import TrimStage from "@/components/create/TrimStage";
import EditStage from "@/components/create/EditStage";
import DetailsStage, { EMPTY_DETAILS, type PublishDetails } from "@/components/create/DetailsStage";
import DiscardDialog from "@/components/create/DiscardDialog";
import "@/styles/create.css";

type Stage = "source" | "camera" | "gallery" | "trim" | "edit" | "details" | "post";
type Kind = "video" | "short";

const MAX_LONG_SECONDS = 12 * 60 * 60;
const MAX_SHORT_SECONDS = 180;

/**
 * HkTube's creation studio.
 *
 * One flow for long videos and Clips, laid out like TikTok's composer: choose or
 * record media, trim it, edit it, then add details and publish. The editing
 * tools are real — everything switched on here is baked into the file that gets
 * uploaded, and "Save to device" runs the same exporter.
 */
export default function CreateStudio() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const soundFromQuery = useMemo(
    () => ({
      id: query.get("soundVideoId") || "",
      title: query.get("soundTitle") || "",
      url: query.get("soundUrl") || "",
    }),
    [query]
  );

  const [stage, setStage] = useState<Stage>(
    query.get("category") === "post" ? "gallery" : "source"
  );
  const [kind, setKind] = useState<Kind>(query.get("category") === "shorts" ? "short" : "video");

  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [fileUrl, setFileUrl] = useState("");
  const [isVertical, setIsVertical] = useState(false);
  /** Source width / height, used to keep the exported frame legal. */
  const [sourceRatio, setSourceRatio] = useState(0);

  const [trim, setTrim] = useState<TrimRange>({ start: 0, end: 0 });
  const [speed, setSpeed] = useState(1);
  const [filter, setFilter] = useState<FilterId>("none");
  const [effects, setEffects] = useState<EffectId[]>([]);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [caption, setCaption] = useState("");
  const [addedAudio, setAddedAudio] = useState<AddedAudio[]>([]);
  const [voiceover, setVoiceover] = useState<Voiceover>({ stream: null, volume: 0.5 });

  const [details, setDetails] = useState<PublishDetails>(EMPTY_DETAILS);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [coverAt, setCoverAt] = useState(0);
  const [editingCover, setEditingCover] = useState(false);
  const [playlists, setPlaylists] = useState<string[]>([]);
  const [channelId, setChannelId] = useState("");
  const [channelError, setChannelError] = useState("");

  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [busyHint, setBusyHint] = useState("");
  const [busyFraction, setBusyFraction] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState("");

  const [postPhoto, setPostPhoto] = useState<MediaEntry | null>(null);
  const [postCaption, setPostCaption] = useState("");
  const [postLink, setPostLink] = useState("");
  const [postPublishing, setPostPublishing] = useState(false);
  const [postProgress, setPostProgress] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const studioUrlRef = useRef(typeof window === "undefined" ? "" : window.location.href);

  const createPost = trpc.posts.create.useMutation();
  const postThumbnail = useMemo(
    () => (postPhoto?.thumbnail ? postPhoto.thumbnail : ""),
    [postPhoto]
  );

  // Once media is loaded the creator has work to lose, on every step including
  // the publish page. A post with a photo or caption counts the same way.
  const dirty = Boolean(file) || (stage === "post" && Boolean(postPhoto || postCaption.trim()));

  /* ------------------------------------------------------------------ setup */

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      startLogin();
      return;
    }
    void (async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("id,handle,name")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);
      if (error) {
        setChannelError("Your channel could not be loaded. Refresh and try again.");
        return;
      }
      if (!data || data.length === 0) {
        setChannelError("Create a channel before publishing.");
        return;
      }
      setChannelId(String(data[0].id));
      setChannelError("");
    })();

    void (async () => {
      const { data } = await supabase.from("playlists").select("title").order("created_at", { ascending: false }).limit(50);
      setPlaylists(((data as Array<{ title?: string }> | null) ?? []).map(row => row.title ?? "").filter(Boolean));
    })();
  }, [authLoading, user]);

  // A typed-out Studio with unsaved work should not vanish on a stray reload.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // The browser's own back button must ask too, not just the in-app arrow.
  useEffect(() => {
    if (!dirty) return;
    const onPopState = () => {
      // The browser has already stepped back by the time this fires, so put the
      // studio's URL back and ask the creator what they want.
      history.pushState({ hkcStudio: true }, "", studioUrlRef.current);
      setDiscardOpen(true);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [dirty]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      voiceover.stream?.getTracks().forEach(track => track.stop());
    };
    // Intentionally unmount-only: re-running would revoke a URL still in use.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------------- media input */

  const acceptFile = useCallback(
    async (picked: File, forcedKind?: Kind) => {
      if (!picked.type.startsWith("video/")) {
        toast.error("Choose a video file.");
        return;
      }
      const seconds = await mediaDuration(picked);
      const nextKind: Kind = forcedKind ?? kind;

      if (seconds > MAX_LONG_SECONDS) {
        toast.error("Videos must be under 12 hours.");
        return;
      }

      // Measure the frame once: the ratio decides the framing, and the export
      // needs it to know whether the picture has to be reshaped.
      const probeResult = await new Promise<{ vertical: boolean; ratio: number }>(resolve => {
        const probe = document.createElement("video");
        probe.preload = "metadata";
        const url = URL.createObjectURL(picked);
        const done = (value: { vertical: boolean; ratio: number }) => {
          probe.removeAttribute("src");
          URL.revokeObjectURL(url);
          resolve(value);
        };
        probe.addEventListener(
          "loadedmetadata",
          () =>
            done({
              vertical: probe.videoHeight >= probe.videoWidth,
              ratio: probe.videoWidth / Math.max(probe.videoHeight, 1),
            }),
          { once: true }
        );
        probe.addEventListener("error", () => done({ vertical: false, ratio: 0 }), { once: true });
        probe.src = url;
      });
      const vertical = probeResult.vertical;

      // A vertical file cannot be a landscape long video, and the upload API
      // would reject it, so switch the flow rather than dead-ending the creator.
      let resolvedKind = nextKind;
      if (resolvedKind === "video" && vertical) {
        resolvedKind = "short";
        toast.info("This video is vertical, so it is set up as a Clip.");
      }
      if (resolvedKind === "short" && probeResult.ratio >= 1) {
        toast.info("This video is landscape: the frame is fitted into 9:16 with bars, nothing is cut off.");
      }

      if (fileUrl) URL.revokeObjectURL(fileUrl);
      const url = URL.createObjectURL(picked);
      setFile(picked);
      setFileUrl(url);
      setDuration(seconds);
      setIsVertical(vertical);
      setSourceRatio(probeResult.ratio);
      setKind(resolvedKind);
      // A Clip is capped at three minutes. A longer pick is accepted and the
      // selection opens on the first three minutes, the way TikTok's editor
      // starts inside the allowed length instead of refusing the file.
      const initialEnd = resolvedKind === "short" ? Math.min(seconds, MAX_SHORT_SECONDS) : seconds;
      if (resolvedKind === "short" && seconds > MAX_SHORT_SECONDS) {
        toast.info("Clips run up to 3 minutes — your selection starts inside the first 3 minutes. Drag to adjust.");
      }
      setTrim(clampTrim({ start: 0, end: initialEnd }, seconds));
      setCoverAt(Math.min(1, seconds * 0.15));
      setStage("trim");
    },
    [details.title, fileUrl, kind]
  );

  useEffect(() => {
    if (!soundFromQuery.url) return;
    setAddedAudio(current =>
      current.length > 0
        ? current
        : [
            {
              id: "picked-sound",
              name: soundFromQuery.title || "Selected sound",
              url: soundFromQuery.url,
              volume: 0.6,
            },
          ]
    );
  }, [soundFromQuery]);

  /* -------------------------------------------------------- cover frame picker */

  const refreshCover = useCallback(
    async (atSeconds: number) => {
      if (!file) return;
      setBusy(true);
      setBusyLabel("Rendering cover frame");
      setBusyHint("Applying your filter and layers to the selected frame.");
      const frame = await captureEditedFrame(file, atSeconds, { filter, effects, overlays, vertical: isVertical });
      setBusy(false);
      if (!frame) {
        toast.error("That frame could not be rendered. Try another moment.");
        return;
      }
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      setCoverFile(frame);
      setCoverPreview(URL.createObjectURL(frame));
    },
    [file, filter, effects, overlays, isVertical, coverPreview]
  );

  useEffect(() => {
    if (stage !== "details" || !file || coverFile) return;
    void refreshCover(coverAt);
    // Runs once when the details page opens; the creator edits it from there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, file]);

  /* -------------------------------------------------------------- exporting */

  const runExport = useCallback(
    async (reason: "upload" | "download") => {
      if (!file) return null;
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      setBusyFraction(0);
      setBusyLabel(reason === "download" ? "Saving to device" : "Rendering your Clip");
      setBusyHint(
        needsReEncode({
          trim,
          duration,
          filter,
          effects,
          overlays,
          addedAudio,
          hasVoiceover: Boolean(voiceover.stream),
          speed,
        })
          ? "Applying trim, filter, effects, layers and audio. This runs in real time."
          : "Nothing was changed, so the original file is used. No quality is lost."
      );
      try {
        const result = await exportEditedVideo({
          file,
          trim,
          filter,
          effects,
          caption,
          speed,
          overlays,
          addedAudio,
          voiceover: voiceover.stream,
          vertical: isVertical,
          forceReEncode: needsReframe(sourceRatio, isVertical),
          signal: controller.signal,
          onProgress: progress => {
            setBusyFraction(progress.fraction);
            if (progress.secondsRemaining >= 0) {
              setBusyHint(`About ${Math.ceil(progress.secondsRemaining)}s remaining. Keep this tab open.`);
            }
          },
        });
        return result.file;
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "The edit could not be rendered.");
        return null;
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [
      file,
      trim,
      duration,
      filter,
      effects,
      caption,
      speed,
      overlays,
      addedAudio,
      voiceover.stream,
      isVertical,
      sourceRatio,
    ]
  );

  async function saveToDevice() {
    const output = await runExport("download");
    if (!output) return;
    const url = URL.createObjectURL(output);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = output.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast.success("Saved to your device.");
  }

  /* ---------------------------------------------------------------- uploading */

  const canUpload = Boolean(file && details.title.trim() && channelId && !uploading);
  const blocker = channelError
    ? channelError
    : !channelId
      ? "Preparing your channel…"
      : !details.title.trim()
        ? "Add a title or caption to continue."
        : "";

  async function publish() {
    if (!file || !canUpload) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      setUploadPhase("Rendering edits…");
      const output = await runExport("upload");
      if (!output) {
        setUploadPhase("");
        return;
      }

      setUploadPhase("Uploading…");
      await createSupabaseVideo({
        channelId,
        title: details.title.trim(),
        description: details.description.trim(),
        file: output,
        thumbnail: coverFile,
        isShort: kind === "short",
        durationSeconds: Math.max(1, Math.round((trim.end - trim.start) / speed)),
        category: kind === "short" ? "clips" : "regular",
        language: "auto",
        visibility: details.visibility,
        allowComments: details.allowComments,
        allowDownload: details.allowDownload,
        madeForKids: details.madeForKids,
        tags: details.tags
          .split(/[,#\s]+/)
          .map(tag => tag.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 30),
        onProgress: setUploadProgress,
      });

      if (details.location || details.aiGenerated || details.paidPromotion || details.ageRestricted) {
        // Surface the extra publish flags the upload already stored so the watch
        // page can honour them; failures here must not lose a published video.
        await supabase
          .from("videos")
          .update({
            ai_generated: details.aiGenerated,
            age_restricted: details.ageRestricted,
            paid_promotion: details.paidPromotion,
            brand_name: details.paidPromotion ? details.brandName.trim() || null : null,
          })
          .eq("title", details.title.trim())
          .eq("channel_id", channelId)
          .then(
            () => undefined,
            () => undefined
          );
      }

      toast.success(kind === "short" ? "Short published" : "Video published");
      navigate(kind === "short" ? "/clips" : "/");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Upload failed.");
      setUploadPhase("");
    } finally {
      setUploading(false);
    }
  }

  /* ------------------------------------------------------------ publish post */

  async function publishPost() {
    if (postPublishing) return;
    if (!postPhoto && !postCaption.trim()) return;
    setPostPublishing(true);
    try {
      let mediaUrl: string | undefined;
      if (postPhoto) {
        setPostProgress("Uploading your photo…");
        const extension = (postPhoto.name.split(".").pop() || "jpg").toLowerCase();
        const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
        const { error } = await supabase.storage.from("thumbnails").upload(path, postPhoto.blob, {
          cacheControl: "3600",
          upsert: false,
          contentType: postPhoto.mimeType || "image/jpeg",
        });
        if (error) throw new Error(`The photo could not be uploaded: ${error.message}`);
        mediaUrl = supabase.storage.from("thumbnails").getPublicUrl(path).data.publicUrl;
      }

      setPostProgress("Publishing…");
      await createPost.mutateAsync({
        body: postCaption.trim() || " ",
        ...(mediaUrl ? { mediaUrl } : {}),
        ...(postLink.trim() ? { linkUrl: postLink.trim() } : {}),
      });
      toast.success("Post published");
      navigate("/posts");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "The post could not be published.");
    } finally {
      setPostProgress("");
      setPostPublishing(false);
    }
  }

  /* -------------------------------------------------------------- navigation */

  function requestClose() {
    if (dirty) setDiscardOpen(true);
    else navigate("/");
  }

  function goBack() {
    if (stage === "details") return setStage("edit");
    if (stage === "edit") return setStage("trim");
    if (stage === "trim") return setStage("source");
    if (stage === "camera" || stage === "gallery") return setStage("source");
    if (stage === "post") return setStage("gallery");
    requestClose();
  }

  const stageTitle =
    stage === "source"
      ? "Create"
      : stage === "camera"
        ? kind === "short"
          ? "Record a Clip"
          : "Record a video"
        : stage === "gallery"
          ? "Gallery"
          : stage === "post"
            ? "New post"
          : stage === "trim"
            ? "Trim"
          : stage === "edit"
            ? "Edit"
            : "Add details";

  if (authLoading || !user) {
    return (
      <HkTubeShell title="Create">
        <div className="grid min-h-[55vh] place-items-center">
          <Loader2 className="size-7 animate-spin text-fuchsia-300" />
        </div>
      </HkTubeShell>
    );
  }

  return (
    <div className="hkc-root">
      <header className={stage === "camera" ? "hkc-top hkc-top--float" : "hkc-top"}>
        <button type="button" className="hkc-icon-btn" onClick={goBack} aria-label="Go back">
          <ArrowLeft />
        </button>
        <span className="hkc-title">{stageTitle}</span>
        {stage === "trim" || stage === "edit" ? (
          <button
            type="button"
            className="hkc-pill"
            onClick={() => setStage(stage === "trim" ? "edit" : "details")}
          >
            Next
          </button>
        ) : stage === "source" || stage === "details" || stage === "post" ? (
          <button type="button" className="hkc-icon-btn" onClick={requestClose} aria-label="Close create studio">
            <X />
          </button>
        ) : (
          <span style={{ width: 40 }} />
        )}
      </header>

      {stage === "source" && (
        <div className="hkc-stage" style={{ alignItems: "flex-start", placeItems: "stretch" }}>
          <div style={{ width: "100%", padding: "8px 16px 24px", overflowY: "auto" }}>
            <p className="hkc-row-hint" style={{ marginBottom: 14 }}>
              Pick what you want to create. Long videos are landscape 16:9, Clips are vertical 9:16.
            </p>

            {channelError && (
              <div className="hkc-note" style={{ borderColor: "rgba(254,44,85,.35)", color: "#ffb3c1" }}>
                {channelError}{" "}
                <button
                  type="button"
                  style={{ textDecoration: "underline", background: "none", border: 0, color: "inherit", cursor: "pointer" }}
                  onClick={() => navigate("/channel/create")}
                >
                  Create a channel
                </button>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
              {(
                [
                  { id: "video" as Kind, label: "Long video", hint: "16:9 landscape", ratio: "16 / 9" },
                  { id: "short" as Kind, label: "Clip", hint: "9:16 vertical", ratio: "9 / 16" },
                ] as const
              ).map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setKind(option.id);
                    setStage("gallery");
                  }}
                  style={{
                    display: "grid",
                    gap: 8,
                    padding: 14,
                    border: `1px solid ${kind === option.id ? "#fe2c55" : "rgba(255,255,255,.12)"}`,
                    borderRadius: 14,
                    background: "rgba(255,255,255,.04)",
                    color: "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      display: "grid",
                      width: 54,
                      aspectRatio: option.ratio,
                      placeItems: "center",
                      border: "1px solid rgba(255,255,255,.25)",
                      borderRadius: 7,
                      margin: "0 auto",
                    }}
                  >
                    <Images className="size-4" />
                  </span>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>{option.label}</span>
                  <span style={{ fontSize: 11.5, opacity: 0.62 }}>{option.hint}</span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  setKind("short");
                  setStage("camera");
                }}
                style={sourceButtonStyle}
              >
                <Sparkles className="size-5" />
                <span style={{ fontWeight: 800, fontSize: 14 }}>Record</span>
                <span style={{ fontSize: 11.5, opacity: 0.62 }}>
                  {isRecordingSupported() ? "Camera, timer, speed, filters" : "Camera not supported here"}
                </span>
              </button>

              <button type="button" onClick={() => setStage("gallery")} style={sourceButtonStyle}>
                <Images className="size-5" />
                <span style={{ fontWeight: 800, fontSize: 14 }}>Gallery</span>
                <span style={{ fontSize: 11.5, opacity: 0.62 }}>Folders and imported media</span>
              </button>
            </div>

            <p className="hkc-note">
              The gallery step keeps the media you import on this device and shows it in folders, so
              trimming and editing work on the real file before anything is uploaded.
            </p>
          </div>
        </div>
      )}

      {stage === "gallery" && (
        <GalleryStage
          onPicked={(entry: MediaEntry) => {
            const picked = new File([entry.blob], entry.name, { type: entry.mimeType || "video/mp4" });
            void acceptFile(picked, kind);
          }}
          onPhotoPicked={(entry: MediaEntry) => {
            // A photo cannot be trimmed or retimed like video, so it goes down
            // the Post path — the real composer, with the photo already picked.
            setPostPhoto(entry);
            setStage("post");
          }}
          onCancel={() => setStage("source")}
          photosOnly={query.get("category") === "post"}
        />
      )}

      {stage === "camera" && (
        <div className="hkc-stage">
          <CameraStage
            vertical={kind === "short"}
            filter={filter}
            onFilterChange={setFilter}
            onRecorded={(clip: CameraClip) => {
              setFilter(clip.filter);
              setSpeed(clip.speed);
              void acceptFile(clip.file, "short");
            }}
            onClose={() => setStage("source")}
            onOpenGallery={() => setStage("gallery")}
            galleryThumb={coverPreview || null}
          />
        </div>
      )}

      {stage === "trim" && file && (
        <TrimStage
          src={fileUrl}
          duration={duration}
          trim={trim}
          onTrimChange={setTrim}
        />
      )}

      {stage === "edit" && file && (
        <EditStage
          previewSrc={fileUrl}
          filter={filter}
          effects={effects}
          overlays={overlays}
          caption={caption}
          addedAudio={addedAudio}
          voiceover={voiceover}
          voiceoverAvailable={Boolean(navigator.mediaDevices?.getUserMedia)}
          busy={busy}
          busyLabel={busyLabel}
          busyHint={busyHint}
          busyFraction={busyFraction}
          onFilterChange={setFilter}
          onEffectsChange={setEffects}
          onOverlaysChange={setOverlays}
          onCaptionChange={setCaption}
          onAddedAudioChange={setAddedAudio}
          onVoiceoverChange={setVoiceover}
          speed={speed}
          onSpeedChange={setSpeed}
          onSaveToDevice={() => void saveToDevice()}
        />
      )}

      {stage === "details" && file && (
        <DetailsStage
          details={details}
          onChange={patch => setDetails(current => ({ ...current, ...patch }))}
          coverUrl={coverPreview || null}
          isShort={kind === "short"}
          hasCustomCover={Boolean(coverFile)}
          onEditCover={() => setEditingCover(true)}
          playlists={playlists}
          onUpload={() => void publish()}
          uploading={uploading}
          uploadProgress={uploadProgress}
          uploadPhase={uploadPhase}
          canUpload={canUpload}
          blocker={blocker}
        />
      )}

      {stage === "post" && (
        <PostStage
          photo={postPhoto}
          thumbnailSrc={postThumbnail}
          caption={postCaption}
          link={postLink}
          publishing={postPublishing}
          progressLabel={postProgress || "Working…"}
          onCaptionChange={setPostCaption}
          onLinkChange={setPostLink}
          onOpenGallery={() => setStage("gallery")}
          onClearPhoto={() => setPostPhoto(null)}
          onPublish={() => void publishPost()}
        />
      )}

      {editingCover && (
        <CoverPicker
          file={file}
          at={coverAt}
          duration={duration}
          onCancel={() => setEditingCover(false)}
          onPick={seconds => {
            setCoverAt(seconds);
            void refreshCover(seconds);
            setEditingCover(false);
          }}
        />
      )}

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

const sourceButtonStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  placeItems: "center",
  padding: 18,
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 14,
  background: "rgba(255,255,255,.04)",
  color: "#fff",
  cursor: "pointer",
  textAlign: "center",
};

/** Frame-accurate cover picker over the trimmed range. */
function CoverPicker({
  file,
  at,
  duration,
  onCancel,
  onPick,
}: {
  file: File | null;
  at: number;
  duration: number;
  onCancel: () => void;
  onPick: (seconds: number) => void;
}) {
  const [value, setValue] = useState(at);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = url;
    video.preload = "auto";
    video.muted = true;
    const onSeeked = () => {
      const canvas = document.createElement("canvas");
      const width = 180;
      canvas.width = width;
      canvas.height = Math.max(1, Math.round((video.videoHeight / Math.max(video.videoWidth, 1)) * width));
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setPreview(canvas.toDataURL("image/jpeg", 0.7));
      }
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = Math.max(0, Math.min(value, Math.max(0, duration - 0.1)));
    return () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
  }, [file, value, duration]);

  return (
    <div className="hkc-overlay" role="dialog" aria-modal="true" aria-label="Choose a cover">
      <div className="hkc-dialog" style={{ width: "min(440px, 100%)" }}>
        <h2 className="hkc-dialog-title">Choose a cover</h2>
        <p className="hkc-dialog-body">Drag the slider to pick the frame viewers see first.</p>
        <div
          style={{
            display: "grid",
            placeItems: "center",
            marginBottom: 14,
            overflow: "hidden",
            borderRadius: 12,
            background: "#000",
          }}
        >
          {preview ? <img src={preview} alt="Cover preview" style={{ maxHeight: 220, objectFit: "contain" }} /> : null}
        </div>
        <input
          type="range"
          className="hkc-range"
          style={{ width: "100%" }}
          min={0}
          max={Math.max(0.1, duration)}
          step={0.05}
          value={value}
          onChange={event => setValue(Number(event.target.value))}
        />
        <p className="hkc-row-hint" style={{ marginTop: 6 }}>
          {value.toFixed(1)}s of {duration.toFixed(1)}s
        </p>
        <div className="hkc-dialog-actions" style={{ marginTop: 16 }}>
          <button type="button" className="hkc-pill hkc-pill--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="hkc-pill" onClick={() => onPick(value)}>
            Use this frame
          </button>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ArrowLeft, Image as ImageIcon, Loader2, Scissors, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { supabase } from "@/lib/supabase";
import { createSupabaseVideo } from "@/lib/supabaseVideos";
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
import { searchMentionCandidates, type MentionCandidate } from "@/lib/channelIdentity";
import { EMPTY_PUBLISH_DETAILS, validatePublishDetails, type PublishDetails } from "@/lib/publishOptions";
import { addVideoToPlaylist, saveVideoExtras } from "@/lib/videoPublishExtras";
import {
  estimateRemainingFromPercent,
  failJob,
  finishJob,
  startJob,
  updateJob,
} from "@/lib/uploadActivity";
import CameraStage, { type CameraClip } from "@/components/create/CameraStage";
import GalleryStage from "@/components/create/GalleryStage";
import TrimStage from "@/components/create/TrimStage";
import EditStage from "@/components/create/EditStage";
import UploadDetailsPage from "@/components/create/UploadDetailsPage";
import DiscardDialog from "@/components/create/DiscardDialog";
import type { PlaylistChoice } from "@/components/create/PlaylistPicker";
import type { MediaEntry } from "@/lib/mediaLibrary";
import "@/styles/create.css";

type Stage = "gallery" | "camera" | "selected" | "trim" | "edit" | "details";
type Kind = "video" | "short";

/** Uploads are capped at twelve hours by the platform. */
const MAX_LONG_SECONDS = 12 * 60 * 60;
/** A Clip is capped at three minutes. */
const MAX_SHORT_SECONDS = 180;

/**
 * HkTube's creation studio, built to follow YouTube's upload flow.
 *
 * Long video: gallery → the picked clip → "Edit into a Short" or "Next" → Add
 * details → Upload.
 * Short: the Shorts camera (Flip, Timer, Speed, Flash and a gallery button) →
 * trim, "Drag to adjust video" → the editor → Add details → Upload Short.
 *
 * The editor is real: filters, effects, text, stickers, captions, sound and the
 * chosen speed are baked into the file that is uploaded, and the upload carries
 * the same Prepare/Send progress lines the YouTube app shows.
 */
export default function CreateStudio() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const category = query.get("category") ?? "regular";
  const initialKind: Kind = category === "shorts" ? "short" : "video";

  const [stage, setStage] = useState<Stage>(category === "shorts" ? "camera" : "gallery");
  const [kind, setKind] = useState<Kind>(initialKind);

  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [fileUrl, setFileUrl] = useState("");
  const [sourceRatio, setSourceRatio] = useState(0);
  const [resolution, setResolution] = useState<{ width: number; height: number } | null>(null);

  const [trim, setTrim] = useState<TrimRange>({ start: 0, end: 0 });
  const [speed, setSpeed] = useState(1);
  const [filter, setFilter] = useState<FilterId>("none");
  const [effects, setEffects] = useState<EffectId[]>([]);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [caption, setCaption] = useState("");
  const [addedAudio, setAddedAudio] = useState<AddedAudio[]>([]);
  const [voiceover, setVoiceover] = useState<Voiceover>({ stream: null, volume: 0.5 });

  const [details, setDetails] = useState<PublishDetails>(EMPTY_PUBLISH_DETAILS);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [coverAt, setCoverAt] = useState(0);
  const [coverPicking, setCoverPicking] = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistChoice[]>([]);
  const [mentionCandidates, setMentionCandidates] = useState<MentionCandidate[]>([]);
  const [channelId, setChannelId] = useState("");
  const [channelError, setChannelError] = useState("");

  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [busyHint, setBusyHint] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);

  const galleryRef = useRef<HTMLInputElement | null>(null);
  const thumbInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const publishedRef = useRef(false);
  const autoPickRef = useRef(false);
  const studioUrlRef = useRef(typeof window === "undefined" ? "" : window.location.href);

  const dirty = Boolean(file) && !publishedRef.current;

  /* ------------------------------------------------------------------ setup */

  // The post composer is its own page; /create?category=post is an alias for it.
  useEffect(() => {
    if (category === "post") navigate("/posts/new", { replace: true });
  }, [category, navigate]);

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
      const channel = (data ?? [])[0] as { id: string | number } | undefined;
      if (!channel) {
        setChannelError("Create a channel before publishing.");
        return;
      }
      setChannelId(String(channel.id));
      setChannelError("");
    })();

    void (async () => {
      const { data } = await supabase
        .from("playlists")
        .select("id,title")
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(60);
      setPlaylists(
        ((data ?? []) as Array<{ id: string | number; title: string | null }>).map(row => ({
          id: String(row.id),
          title: row.title ?? "Playlist",
        }))
      );
    })();

    void searchMentionCandidates("").then(rows => setMentionCandidates(rows));
  }, [authLoading, user]);

  // Opening the studio for a long video lands on the gallery, the way tapping
  // "Upload a video" opens the phone's gallery. The browser only allows the
  // system picker inside a user gesture, so it is attempted once and the folder
  // grid stays there when a browser refuses.
  useEffect(() => {
    if (category !== "regular" || autoPickRef.current) return;
    autoPickRef.current = true;
    const timer = window.setTimeout(() => {
      if (stage !== "gallery" || file) return;
      try {
        galleryRef.current?.click();
      } catch {
        // The gallery stage is the fallback.
      }
    }, 350);
    return () => window.clearTimeout(timer);
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!dirty) return;
    const onPopState = () => {
      history.pushState({ hkcStudio: true }, "", studioUrlRef.current);
      setDiscardOpen(true);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [dirty]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      voiceover.stream?.getTracks().forEach(track => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  /* ------------------------------------------------------------- media input */

  const acceptFile = useCallback(
    async (picked: File, forcedKind?: Kind) => {
      if (!picked.type.startsWith("video/")) {
        toast.error("Choose a video file.");
        return;
      }
      const seconds = await mediaDuration(picked);
      if (!Number.isFinite(seconds) || seconds <= 0) {
        toast.error("That file could not be read as a video. Try re-exporting it as MP4.");
        return;
      }
      if (seconds > MAX_LONG_SECONDS) {
        toast.error("Videos must be under 12 hours.");
        return;
      }

      const probe = await new Promise<{ horizontal: boolean; ratio: number; width: number; height: number }>(resolve => {
        const element = document.createElement("video");
        element.preload = "metadata";
        const url = URL.createObjectURL(picked);
        const done = (value: { horizontal: boolean; ratio: number; width: number; height: number }) => {
          element.removeAttribute("src");
          URL.revokeObjectURL(url);
          resolve(value);
        };
        element.addEventListener(
          "loadedmetadata",
          () =>
            done({
              horizontal: element.videoWidth >= element.videoHeight,
              ratio: element.videoWidth / Math.max(element.videoHeight, 1),
              width: element.videoWidth,
              height: element.videoHeight,
            }),
          { once: true }
        );
        element.addEventListener("error", () => done({ horizontal: true, ratio: 0, width: 0, height: 0 }), {
          once: true,
        });
        element.src = url;
      });

      let resolvedKind: Kind = forcedKind ?? kind;
      // A vertical file cannot be a landscape long video, so the flow switches
      // rather than dead-ending on the upload API's ratio check.
      if (resolvedKind === "video" && !probe.horizontal) {
        resolvedKind = "short";
        toast.info("This video is vertical, so it is set up as a Clip.");
      }
      if (resolvedKind === "short" && probe.horizontal) {
        toast.info("A landscape video is fitted into 9:16 with bars for a Clip, so nothing is cut off.");
      }

      const url = URL.createObjectURL(picked);
      setFile(picked);
      setFileUrl(url);
      setDuration(seconds);
      setSourceRatio(probe.ratio);
      setResolution({ width: probe.width, height: probe.height });
      setKind(resolvedKind);
      const initialEnd = resolvedKind === "short" ? Math.min(seconds, MAX_SHORT_SECONDS) : seconds;
      if (resolvedKind === "short" && seconds > MAX_SHORT_SECONDS) {
        toast.info("Clips run up to 3 minutes — the selection starts inside the first 3 minutes. Drag to adjust.");
      }
      setTrim(clampTrim({ start: 0, end: initialEnd }, seconds));
      setCoverAt(Math.min(1, seconds * 0.15));
      // A long video stops on the "Edit into a Short / Next" step first.
      setStage(resolvedKind === "video" ? "selected" : "trim");
    },
    [kind]
  );

  /* -------------------------------------------------------- cover frame picker */

  const refreshCover = useCallback(
    async (atSeconds: number) => {
      if (!file) return;
      setBusy(true);
      setBusyLabel("Rendering cover frame");
      setBusyHint("Applying your filter and layers to the selected frame.");
      const frame = await captureEditedFrame(file, atSeconds, {
        filter,
        effects,
        overlays,
        caption,
        vertical: kind === "short",
      });
      setBusy(false);
      if (!frame) {
        toast.error("That frame could not be rendered. Try another moment.");
        return;
      }
      setCoverFile(frame);
      setCoverPreview(URL.createObjectURL(frame));
    },
    [file, filter, effects, overlays, caption, kind]
  );

  useEffect(() => {
    if (stage !== "details" || !file || coverFile) return;
    void refreshCover(coverAt);
    // Runs once when the details page opens; the creator edits it from there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, file]);

  /* ------------------------------------------------------------------ publish */

  const validation = useMemo(
    () =>
      validatePublishDetails(details, {
        isShort: kind === "short",
        durationSeconds: trim.end - trim.start,
        hasCover: Boolean(coverFile),
      }),
    [details, kind, trim.end, trim.start, coverFile]
  );

  const canUpload = Boolean(file && channelId && validation.ok && !uploading);
  const blocker = channelError
    ? channelError
    : !channelId
      ? "Preparing your channel…"
      : validation.blockers[0] ?? "";

  async function publish() {
    if (!file || !canUpload || !user) return;
    const title = details.title.trim();
    const jobId = `upload-${Date.now()}`;
    startJob({
      id: jobId,
      title: title || (kind === "short" ? "Your Short" : "Your video"),
      isShort: kind === "short",
      href: "/profile",
      thumbnail: coverPreview || null,
    });

    setUploading(true);
    setUploadPhase("Preparing 0%");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // 1. Prepare: bake the trim, filters, effects, layers and audio.
      const needsBake =
        needsReEncode({
          trim,
          duration,
          filter,
          effects,
          overlays,
          addedAudio,
          hasVoiceover: Boolean(voiceover.stream),
          speed,
          hasCaption: Boolean(caption.trim()),
        }) || needsReframe(sourceRatio, kind === "short");

      const prepared = await exportEditedVideo({
        file,
        trim,
        filter,
        effects,
        caption,
        speed,
        overlays,
        addedAudio,
        voiceover: voiceover.stream,
        vertical: kind === "short",
        forceReEncode: needsReframe(sourceRatio, kind === "short"),
        signal: controller.signal,
        onProgress: progress => {
          const percent = Math.round(progress.fraction * 100);
          setUploadPhase(`Preparing ${percent}%`);
          updateJob(jobId, { stage: "preparing", progress: percent, secondsRemaining: null });
        },
      });
      updateJob(jobId, { stage: "preparing", progress: 100 });
      setUploadPhase("Preparing 100%");

      // 2. Send: upload the finished file and report the same countdown YouTube does.
      const sendingStartedAt = Date.now();
      updateJob(jobId, { stage: "sending", progress: 0, secondsRemaining: null });
      const created = await createSupabaseVideo({
        channelId,
        title,
        description: details.description.trim(),
        file: prepared.file,
        thumbnail: coverFile,
        isShort: kind === "short",
        durationSeconds: Math.max(1, Math.round((trim.end - trim.start) / speed)),
        category: kind === "short" ? "shorts" : "regular",
        language: "auto",
        visibility: details.visibility,
        allowComments: details.allowComments && !details.madeForKids,
        allowDownload: details.allowDownload,
        madeForKids: details.madeForKids,
        tags: details.tags,
        signal: controller.signal,
        onProgress: percent => {
          const rounded = Math.round(percent);
          setUploadPhase(`Sending file ${rounded}%`);
          updateJob(jobId, {
            stage: "sending",
            progress: rounded,
            secondsRemaining: estimateRemainingFromPercent(rounded, sendingStartedAt),
          });
        },
      });

      // 3. Processing: the row is in, the extras and playlist follow.
      updateJob(jobId, { stage: "processing", progress: 10, secondsRemaining: null });
      setUploadPhase("Processing");

      const videoId = String((created as { id?: string | number } | null)?.id ?? "");
      const notes: string[] = [];
      if (videoId) {
        notes.push(
          ...(await saveVideoExtras(videoId, {
            location: details.location,
            aiGenerated: details.aiGenerated,
            ageRestricted: details.ageRestricted,
            paidPromotion: details.paidPromotion,
            brandName: details.brandName,
            remix: details.remix,
          }))
        );
        if (details.playlistId) {
          const playlistError = await addVideoToPlaylist(details.playlistId, videoId);
          if (playlistError) notes.push(playlistError);
        }
      }

      const href = videoId ? `/watch/${videoId}` : "/profile";
      publishedRef.current = true;
      finishJob(jobId, { href, detail: notes[0] ?? null });
      for (const note of notes) toast.info(note);
      toast.success(kind === "short" ? "Short published." : "Video published.");
      navigate("/profile");
    } catch (caught) {
      publishedRef.current = false;
      const message = caught instanceof Error ? caught.message : "The upload failed.";
      failJob(jobId, message);
      toast.error(message);
    } finally {
      setUploading(false);
      setUploadPhase("");
      abortRef.current = null;
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
    if (stage === "trim") return setStage(file ? "selected" : "gallery");
    if (stage === "selected") return setStage("gallery");
    if (stage === "camera") return setStage("gallery");
    requestClose();
  }

  const stageTitle =
    stage === "gallery"
      ? "Select a video"
      : stage === "camera"
        ? "Record a Short"
        : stage === "selected"
          ? "Upload a video"
          : stage === "trim"
            ? kind === "short"
              ? "Trim your Short"
              : "Trim"
            : stage === "edit"
              ? "Edit"
              : "Add details";

  const durationLabel = `${(trim.end - trim.start).toFixed(1)}s`;
  const resolutionLabel = resolution ? `${resolution.width}×${resolution.height}` : "unknown size";

  if (authLoading || !user) {
    return (
      <div className="hkc-root">
        <div className="grid min-h-[60vh] place-items-center">
          <Loader2 className="size-7 animate-spin text-fuchsia-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="hkc-root">
      <header className={stage === "camera" ? "hkc-top hkc-top--float" : "hkc-top"}>
        <button type="button" className="hkc-icon-btn" onClick={goBack} aria-label="Go back">
          <ArrowLeft />
        </button>
        <span className="hkc-title">{stageTitle}</span>
        {stage === "camera" ? (
          <span style={{ width: 40 }} />
        ) : stage === "trim" || stage === "edit" ? (
          <button
            type="button"
            className="hkc-pill"
            onClick={() => setStage(stage === "trim" ? "edit" : "details")}
          >
            Next
          </button>
        ) : (
          <button type="button" className="hkc-icon-btn" onClick={requestClose} aria-label="Close upload">
            <X />
          </button>
        )}
      </header>

      {stage === "gallery" && (
        <GalleryStage
          onPicked={(entry: MediaEntry) => {
            const picked = new File([entry.blob], entry.name, { type: entry.mimeType || "video/mp4" });
            void acceptFile(picked, kind);
          }}
          onPhotoPicked={() => {
            toast.info("Photos go to the Post composer, where you can post up to ten images.");
            navigate("/posts/new");
          }}
          onCancel={() => navigate("/")}
        />
      )}

      {stage === "camera" && (
        <div className="hkc-stage">
          <CameraStage
            vertical
            filter={filter}
            onFilterChange={setFilter}
            onRecorded={(clip: CameraClip) => {
              setFilter(clip.filter);
              setSpeed(clip.speed);
              void acceptFile(clip.file, "short");
            }}
            onClose={() => setStage("gallery")}
            onOpenGallery={() => setStage("gallery")}
            galleryThumb={coverPreview || null}
          />
        </div>
      )}

      {stage === "selected" && file && (
        <div className="hkc-stage">
          <div className="hkc-frame hkc-frame--landscape" style={{ width: "100%", aspectRatio: "16 / 9" }}>
            <video src={fileUrl} controls playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>

          <div style={{ width: "100%", padding: "0 16px 20px", display: "grid", gap: 10, marginTop: 14 }}>
            <p className="hkc-row-hint" style={{ textAlign: "center" }}>
              {file.name} · {duration.toFixed(1)}s · {resolutionLabel}
            </p>
            <button
              type="button"
              className="hkc-pill hkc-pill--ghost"
              style={{ width: "100%", minHeight: 46, justifyContent: "center" }}
              onClick={() => {
                setKind("short");
                setTrim(current => clampTrim({ start: 0, end: Math.min(current.end, MAX_SHORT_SECONDS) }, duration));
                setStage("trim");
              }}
            >
              <Scissors className="size-4" /> Edit into a Short
            </button>
            <button
              type="button"
              className="hkc-pill"
              style={{ width: "100%", minHeight: 46, justifyContent: "center" }}
              onClick={() => setStage("details")}
            >
              Next
            </button>
            <p className="hkc-row-hint" style={{ textAlign: "center" }}>
              Edit into a Short makes a vertical Clip from this video. Next takes you straight to Add details.
            </p>
          </div>
        </div>
      )}

      {stage === "trim" && file && (
        <TrimStage src={fileUrl} duration={duration} trim={trim} onTrimChange={setTrim} />
      )}

      {stage === "edit" && file && (
        <EditStage
          previewSrc={fileUrl}
          filter={filter}
          effects={effects}
          overlays={overlays}
          caption={caption}
          speed={speed}
          addedAudio={addedAudio}
          voiceover={voiceover}
          voiceoverAvailable={Boolean(navigator.mediaDevices?.getUserMedia)}
          busy={busy}
          busyLabel={busyLabel}
          busyHint={busyHint}
          busyFraction={0}
          onFilterChange={setFilter}
          onEffectsChange={setEffects}
          onOverlaysChange={setOverlays}
          onCaptionChange={setCaption}
          onSpeedChange={setSpeed}
          onAddedAudioChange={setAddedAudio}
          onVoiceoverChange={setVoiceover}
          onSaveToDevice={() => {
            void (async () => {
              if (!file) return;
              setBusy(true);
              setBusyLabel("Saving to your device");
              setBusyHint("Baking the edit locally. This runs in real time.");
              try {
                const exported = await exportEditedVideo({
                  file,
                  trim,
                  filter,
                  effects,
                  caption,
                  speed,
                  overlays,
                  addedAudio,
                  voiceover: voiceover.stream,
                  vertical: kind === "short",
                  forceReEncode: needsReframe(sourceRatio, kind === "short"),
                });
                const url = URL.createObjectURL(exported.file);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = exported.file.name;
                anchor.click();
                window.setTimeout(() => URL.revokeObjectURL(url), 4000);
                toast.success("Saved to your device.");
              } catch (caught) {
                toast.error(caught instanceof Error ? caught.message : "The edit could not be saved.");
              } finally {
                setBusy(false);
              }
            })();
          }}
        />
      )}

      {stage === "details" && file && (
        <UploadDetailsPage
          details={details}
          onChange={patch => setDetails(current => ({ ...current, ...patch }))}
          onUpload={() => void publish()}
          isShort={kind === "short"}
          coverUrl={coverPreview || null}
          hasCustomCover={Boolean(coverFile)}
          onPickCover={() => setCoverPicking(true)}
          onUploadFrame={() => thumbInputRef.current?.click()}
          playlists={playlists}
          onPlaylistsChange={setPlaylists}
          uploading={uploading}
          canUpload={canUpload}
          blocker={blocker}
          progressLabel={uploadPhase || "Uploading…"}
          durationLabel={durationLabel}
          resolutionLabel={resolutionLabel}
          mentionCandidates={mentionCandidates}
        />
      )}

      <input
        ref={galleryRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={event => {
          const picked = event.target.files?.[0];
          event.target.value = "";
          if (picked) void acceptFile(picked);
        }}
      />

      {/* "Change photo": a custom thumbnail straight from the device gallery. */}
      <input
        ref={thumbInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={event => {
          const picked = event.target.files?.[0];
          event.target.value = "";
          if (!picked) return;
          if (!picked.type.startsWith("image/")) {
            toast.error("Choose an image for the thumbnail.");
            return;
          }
          if (picked.size > 12 * 1024 * 1024) {
            toast.error("Thumbnails must be under 12 MB.");
            return;
          }
          setCoverFile(picked);
          setCoverPreview(URL.createObjectURL(picked));
          toast.success("Custom thumbnail selected.");
        }}
      />

      {coverPicking && (
        <CoverPicker
          file={file}
          at={coverAt}
          duration={duration}
          onCancel={() => setCoverPicking(false)}
          onPick={seconds => {
            setCoverAt(seconds);
            void refreshCover(seconds);
            setCoverPicking(false);
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

/**
 * Frame-accurate cover picker over the trimmed range. The chosen frame is baked
 * with the active filter and layers, so the thumbnail matches the upload.
 */
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
      const width = 200;
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
    <div className="hkc-overlay" role="dialog" aria-modal="true" aria-label="Select a cover frame">
      <div className="hkc-dialog" style={{ width: "min(460px, 100%)" }}>
        <h2 className="hkc-dialog-title">Select a cover frame</h2>
        <p className="hkc-dialog-body">
          Drag to choose the frame viewers see first. Use Change photo to upload your own thumbnail instead.
        </p>
        <div style={{ display: "grid", placeItems: "center", margin: "12px 0", background: "#000", borderRadius: 12, overflow: "hidden" }}>
          {preview ? (
            <img src={preview} alt="Cover preview" style={{ maxHeight: 230, objectFit: "contain" }} />
          ) : (
            <ImageIcon className="size-6" style={{ margin: 24 }} />
          )}
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
            Save this frame
          </button>
        </div>
      </div>
    </div>
  );
}

/** True when this browser can record a Short with the camera. */
export const studioSupportsRecording = isRecordingSupported;

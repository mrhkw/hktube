import {
  Captions,
  Download,
  Gauge,
  Lightbulb,
  Mic,
  Music2,
  Sparkles,
  Sticker,
  Trash2,
  Type,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";
import {
  clampOverlayPosition,
  EFFECT_PRESETS,
  FILTER_PRESETS,
  STICKER_SET,
  TEXT_COLORS,
  TEXT_FONTS,
  textFont,
  type AddedAudio,
  type EffectId,
  type FilterId,
  type Overlay,
  type StickerOverlay,
  type TextOverlay,
  type TextFontId,
  type Voiceover,
} from "@/lib/videoEditor";

/** Speed choices offered in the editor, matching the camera's control. */
const SPEED_CHOICES = [0.3, 0.5, 1, 1.5, 2, 3] as const;

type ToolId = "text" | "filters" | "effects" | "stickers" | "captions" | "sound" | "save";

/**
 * A patch for one overlay. Written as a union rather than a `Partial` of an
 * intersection, because `TextOverlay & StickerOverlay` collapses the fields the
 * two shapes disagree on (`text`/`emoji`) to `never`.
 */
type OverlayPatch =
  | (Partial<Omit<TextOverlay, "id" | "kind">> & { kind?: "text" })
  | (Partial<Omit<StickerOverlay, "id" | "kind">> & { kind?: "sticker" });

const TOOLS: Array<{ id: ToolId; label: string; icon: typeof Type }> = [
  { id: "text", label: "Text", icon: Type },
  { id: "filters", label: "Filters", icon: Wand2 },
  { id: "effects", label: "Effects", icon: Sparkles },
  { id: "stickers", label: "Stickers", icon: Sticker },
  { id: "captions", label: "Captions", icon: Captions },
  { id: "sound", label: "Sound", icon: Music2 },
  { id: "save", label: "Save", icon: Download },
];

/**
 * The editing suite that sits between trimming and publishing.
 *
 * Every tool here changes the exported file: text and stickers are drawn onto
 * the canvas, filters and effects are applied at export, added audio and the
 * voiceover are mixed through Web Audio, and "Save to device" runs the same
 * exporter so the saved file matches the upload.
 */
export default function EditStage({
  previewSrc,
  filter,
  effects,
  overlays,
  caption,
  speed,
  addedAudio,
  voiceover,
  voiceoverAvailable,
  busy,
  busyLabel,
  busyHint,
  busyFraction,
  onFilterChange,
  onEffectsChange,
  onOverlaysChange,
  onCaptionChange,
  onSpeedChange,
  onAddedAudioChange,
  onVoiceoverChange,
  onSaveToDevice,
}: {
  previewSrc: string;
  filter: FilterId;
  effects: EffectId[];
  overlays: Overlay[];
  caption: string;
  speed: number;
  addedAudio: AddedAudio[];
  voiceover: Voiceover;
  voiceoverAvailable: boolean;
  busy: boolean;
  busyLabel: string;
  busyHint: string;
  busyFraction: number;
  onFilterChange: (filter: FilterId) => void;
  onEffectsChange: (effects: EffectId[]) => void;
  onOverlaysChange: (overlays: Overlay[]) => void;
  onCaptionChange: (caption: string) => void;
  onSpeedChange: (speed: number) => void;
  onAddedAudioChange: (audio: AddedAudio[]) => void;
  onVoiceoverChange: (voiceover: Voiceover) => void;
  onSaveToDevice: () => void;
}) {
  const [tool, setTool] = useState<ToolId>("filters");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState(caption);
  const [recordingVoice, setRecordingVoice] = useState(false);

  const previewRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: string; pointerId: number } | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => setCaptionDraft(caption), [caption]);

  // The preview plays at exactly the speed the export bakes in.
  useEffect(() => {
    const element = previewRef.current;
    if (element) element.playbackRate = speed;
  }, [speed]);

  // Releasing the microphone when the studio closes is not optional.
  useEffect(() => {
    return () => {
      voiceStreamRef.current?.getTracks().forEach(track => track.stop());
      voiceStreamRef.current = null;
    };
  }, []);

  function updateOverlay(id: string, patch: OverlayPatch) {
    onOverlaysChange(
      overlays.map(overlay => (overlay.id === id ? ({ ...overlay, ...patch } as Overlay) : overlay))
    );
  }

  function addText() {
    const overlay: TextOverlay = {
      id: `text-${Date.now()}`,
      kind: "text",
      text: "Your text",
      fontId: "bold",
      color: "#ffffff",
      size: 0.075,
      x: 0.5,
      y: 0.5,
      align: "center",
    };
    onOverlaysChange([...overlays, overlay]);
    setSelectedId(overlay.id);
    setTool("text");
  }

  function addSticker(emoji: string) {
    const overlay: StickerOverlay = {
      id: `sticker-${Date.now()}`,
      kind: "sticker",
      emoji,
      size: 0.14,
      x: 0.5,
      y: 0.42,
    };
    onOverlaysChange([...overlays, overlay]);
    setSelectedId(overlay.id);
  }

  function removeOverlay(id: string) {
    onOverlaysChange(overlays.filter(overlay => overlay.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  /* --------------------------------------------------------------- dragging */

  function startDrag(event: ReactPointerEvent<HTMLDivElement>, id: string) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { id, pointerId: event.pointerId };
    setSelectedId(id);
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const position = clampOverlayPosition((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
    updateOverlay(drag.id, position);
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  /* ------------------------------------------------------------------ audio */

  function pickAudio(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      toast.error("Choose an audio file.");
      return;
    }
    const entry: AddedAudio = {
      id: `audio-${Date.now()}`,
      name: file.name.replace(/\.[^.]+$/, "").slice(0, 60) || "Added sound",
      url: URL.createObjectURL(file),
      volume: 0.6,
    };
    onAddedAudioChange([...addedAudio, entry]);
    toast.success("Sound added. It is mixed into the exported Clip.");
  }

  async function toggleVoiceover() {
    if (recordingVoice) {
      voiceStreamRef.current?.getTracks().forEach(track => track.stop());
      voiceStreamRef.current = null;
      onVoiceoverChange({ ...voiceover, stream: null });
      setRecordingVoice(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      onVoiceoverChange({ ...voiceover, stream });
      setRecordingVoice(true);
      toast.success("Voiceover recording. It is mixed in when you upload or save.");
    } catch {
      toast.error("Microphone permission is needed for a voiceover.");
    }
  }

  const selected = overlays.find(overlay => overlay.id === selectedId) ?? null;
  const selectedText = selected?.kind === "text" ? selected : null;

  return (
    <>
      <div className="hkc-stage" ref={stageRef}>
        <div className="hkc-frame hkc-frame--vertical" style={{ width: "100%", height: "100%", aspectRatio: "auto" }}>
          <video
            ref={previewRef}
            src={previewSrc}
            playsInline
            loop
            autoPlay
            muted
            onLoadedMetadata={event => {
              event.currentTarget.playbackRate = speed;
            }}
            style={{ filter: FILTER_PRESETS.find(p => p.id === filter)?.css ?? "none", objectFit: "cover" }}
          />

          {effects.length > 0 && (
            <div className="hkc-layer" style={{ inset: 0, transform: "none", pointerEvents: "none" }}>
              {effects.includes("vignette") && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "radial-gradient(circle at center, transparent 42%, rgba(0,0,0,.55) 100%)",
                  }}
                />
              )}
              {effects.includes("glow") && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "radial-gradient(circle at 50% 42%, rgba(255,255,255,.22), transparent 62%)",
                    mixBlendMode: "screen",
                  }}
                />
              )}
              {effects.includes("grain") && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0.16,
                    backgroundImage:
                      "repeating-conic-gradient(rgba(255,255,255,.5) 0% 25%, transparent 0% 50%)",
                    backgroundSize: "3px 3px",
                  }}
                />
              )}
            </div>
          )}

          {overlays.map(overlay => {
            const isSelected = overlay.id === selectedId;
            if (overlay.kind === "text") {
              const font = textFont(overlay.fontId);
              return (
                <div
                  key={overlay.id}
                  className={"hkc-layer hkc-layer-text" + (isSelected ? " hkc-layer--selected" : "")}
                  style={{
                    left: `${overlay.x * 100}%`,
                    top: `${overlay.y * 100}%`,
                    color: overlay.color,
                    fontFamily: font.family,
                    fontWeight: font.weight,
                    fontSize: `clamp(12px, ${overlay.size * 100}%, 64px)`,
                  }}
                  onPointerDown={event => startDrag(event, overlay.id)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  {overlay.text}
                </div>
              );
            }
            return (
              <div
                key={overlay.id}
                className={"hkc-layer hkc-layer-sticker" + (isSelected ? " hkc-layer--selected" : "")}
                style={{
                  left: `${overlay.x * 100}%`,
                  top: `${overlay.y * 100}%`,
                  fontSize: `clamp(20px, ${overlay.size * 100}%, 96px)`,
                }}
                onPointerDown={event => startDrag(event, overlay.id)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                {overlay.emoji}
              </div>
            );
          })}

          {caption.trim() && <div className="hkc-caption">{caption}</div>}
        </div>

        {busy && (
          <div className="hkc-busy">
            <div className="hkc-busy-card">
              <p className="hkc-busy-title">{busyLabel}</p>
              <p className="hkc-busy-hint">{busyHint}</p>
              <div className="hkc-progress">
                <div style={{ width: `${Math.round(busyFraction * 100)}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="hkc-tools">
        {TOOLS.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={"hkc-tool-tab" + (tool === item.id ? " is-active" : "")}
              onClick={() => setTool(item.id)}
            >
              <Icon />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="hkc-panel">
        {tool === "text" && (
          <>
            <div className="hkc-panel-head">
              <span className="hkc-panel-title">Text</span>
              <button type="button" className="hkc-pill" onClick={addText}>
                <Type className="size-4" />
                Add text
              </button>
            </div>

            {selectedText ? (
              <>
                <label className="hkc-label">Text</label>
                <textarea
                  className="hkc-field"
                  rows={2}
                  value={selectedText.text}
                  maxLength={200}
                  onChange={event => updateOverlay(selectedText.id, { text: event.target.value })}
                />

                <p className="hkc-label" style={{ marginTop: 12 }}>
                  Font
                </p>
                <div className="hkc-chips">
                  {TEXT_FONTS.map(font => (
                    <button
                      key={font.id}
                      type="button"
                      className={"hkc-chip" + (selectedText.fontId === font.id ? " is-active" : "")}
                      style={{ fontFamily: font.family, fontWeight: font.weight }}
                      onClick={() => updateOverlay(selectedText.id, { fontId: font.id as TextFontId })}
                    >
                      {font.label}
                    </button>
                  ))}
                </div>

                <p className="hkc-label" style={{ marginTop: 12 }}>
                  Colour
                </p>
                <div className="hkc-swatches">
                  {TEXT_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Text colour ${color}`}
                      className={"hkc-swatch" + (selectedText.color === color ? " is-active" : "")}
                      style={{ background: color }}
                      onClick={() => updateOverlay(selectedText.id, { color })}
                    />
                  ))}
                </div>

                <label className="hkc-label" style={{ marginTop: 12 }}>
                  Size
                </label>
                <input
                  type="range"
                  className="hkc-range"
                  style={{ width: "100%" }}
                  min={0.03}
                  max={0.2}
                  step={0.005}
                  value={selectedText.size}
                  onChange={event => updateOverlay(selectedText.id, { size: Number(event.target.value) })}
                />

                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button type="button" className="hkc-pill hkc-pill--ghost" onClick={() => removeOverlay(selectedText.id)}>
                    <Trash2 className="size-4" />
                    Remove
                  </button>
                  <button type="button" className="hkc-pill hkc-pill--ghost" onClick={() => setSelectedId(null)}>
                    Deselect
                  </button>
                </div>
              </>
            ) : (
              <p className="hkc-row-hint">
                {overlays.some(o => o.kind === "text")
                  ? "Tap a text layer on the preview to edit it, or add another."
                  : "Add a text layer, then drag it anywhere on the video."}
              </p>
            )}
          </>
        )}

        {tool === "filters" && (
          <>
            <div className="hkc-panel-head">
              <span className="hkc-panel-title">Filters</span>
            </div>
            <div className="hkc-filter-row">
              {FILTER_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  className={"hkc-filter-btn" + (filter === preset.id ? " is-active" : "")}
                  onClick={() => onFilterChange(preset.id)}
                >
                  <span className="hkc-filter-swatch" style={{ filter: preset.css }} />
                  {preset.label}
                </button>
              ))}
            </div>
          </>
        )}

        {tool === "effects" && (
          <>
            <div className="hkc-panel-head">
              <span className="hkc-panel-title">Effects</span>
            </div>
            <div className="hkc-chips">
              {EFFECT_PRESETS.map(preset => {
                const on = effects.includes(preset.id);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={"hkc-chip" + (on ? " is-active" : "")}
                    onClick={() =>
                      onEffectsChange(on ? effects.filter(id => id !== preset.id) : [...effects, preset.id])
                    }
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <p className="hkc-row-hint" style={{ marginTop: 10 }}>
              {EFFECT_PRESETS.find(p => effects.includes(p.id))?.hint ??
                "Effects are painted into the exported Clip, not just the preview."}
            </p>
          </>
        )}

        {tool === "stickers" && (
          <>
            <div className="hkc-panel-head">
              <span className="hkc-panel-title">Stickers</span>
              {selected && <button type="button" className="hkc-pill hkc-pill--ghost" onClick={() => removeOverlay(selected.id)}>
                <Trash2 className="size-4" />
                Remove
              </button>}
            </div>
            <div className="hkc-sticker-grid">
              {STICKER_SET.map(emoji => (
                <button key={emoji} type="button" className="hkc-sticker-btn" onClick={() => addSticker(emoji)}>
                  {emoji}
                </button>
              ))}
            </div>
            <label className="hkc-label" style={{ marginTop: 12 }}>
              Sticker size
            </label>
            <input
              type="range"
              className="hkc-range"
              style={{ width: "100%" }}
              min={0.05}
              max={0.3}
              step={0.005}
              disabled={!selected || selected.kind !== "sticker"}
              value={selected?.kind === "sticker" ? selected.size : 0.14}
              onChange={event => {
                if (selected?.kind === "sticker") updateOverlay(selected.id, { size: Number(event.target.value) });
              }}
            />
          </>
        )}

        {tool === "captions" && (
          <>
            <div className="hkc-panel-head">
              <span className="hkc-panel-title">Captions</span>
            </div>
            <textarea
              className="hkc-field"
              rows={3}
              maxLength={300}
              placeholder="Type what you say, or a line to show on the video…"
              value={captionDraft}
              onChange={event => {
                setCaptionDraft(event.target.value);
                onCaptionChange(event.target.value);
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                type="button"
                className="hkc-pill hkc-pill--ghost"
                onClick={() => {
                  if (!captionDraft.trim()) return;
                  onOverlaysChange([
                    ...overlays,
                    {
                      id: `text-${Date.now()}`,
                      kind: "text",
                      text: captionDraft,
                      fontId: "bold",
                      color: "#ffffff",
                      size: 0.07,
                      x: 0.5,
                      y: 0.78,
                      align: "center",
                    },
                  ]);
                  toast.success("Caption added as a text layer.");
                }}
              >
                Add as text layer
              </button>
              <button
                type="button"
                className="hkc-pill hkc-pill--ghost"
                onClick={() => {
                  setCaptionDraft("");
                  onCaptionChange("");
                }}
              >
                Clear
              </button>
            </div>
            <p className="hkc-note">
              <Lightbulb style={{ display: "inline", width: 13, height: 13, verticalAlign: "-2px" }} /> Automatic
              speech-to-text captions need a configured transcription provider. Rather than show a fake
              “generating…” state, HkTube gives you a real caption banner you write yourself. The
              caption is burned into the uploaded Clip.
            </p>
          </>
        )}

        {tool === "sound" && (
          <>
            <div className="hkc-panel-head">
              <span className="hkc-panel-title">Sound</span>
              <button type="button" className="hkc-pill" onClick={() => audioInputRef.current?.click()}>
                <Music2 className="size-4" />
                Add sound
              </button>
            </div>
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={event => {
                pickAudio(event.target.files);
                event.target.value = "";
              }}
            />

            <div className="hkc-audio-row">
              <Gauge className="size-4 shrink-0" />
              <span className="hkc-audio-name">Speed</span>
              <div className="hkc-chips" style={{ flex: 1, justifyContent: "flex-end" }}>
                {SPEED_CHOICES.map(choice => (
                  <button
                    key={choice}
                    type="button"
                    className={"hkc-chip" + (speed === choice ? " is-active" : "")}
                    onClick={() => onSpeedChange(choice)}
                  >
                    {choice}x
                  </button>
                ))}
              </div>
            </div>

            <div className="hkc-audio-row">
              <Music2 className="size-4 shrink-0" />
              <span className="hkc-audio-name">Original sound</span>
              <input
                type="range"
                className="hkc-range"
                min={0}
                max={1}
                step={0.05}
                value={1 - voiceover.volume}
                onChange={event => onVoiceoverChange({ ...voiceover, volume: 1 - Number(event.target.value) })}
                aria-label="Original sound level"
              />
            </div>

            {addedAudio.map(track => (
              <div key={track.id} className="hkc-audio-row">
                <Music2 className="size-4 shrink-0" />
                <span className="hkc-audio-name">{track.name}</span>
                <input
                  type="range"
                  className="hkc-range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={track.volume}
                  aria-label={`${track.name} volume`}
                  onChange={event =>
                    onAddedAudioChange(
                      addedAudio.map(item =>
                        item.id === track.id ? { ...item, volume: Number(event.target.value) } : item
                      )
                    )
                  }
                />
                <button
                  type="button"
                  className="hkc-icon-btn"
                  style={{ width: 30, height: 30, background: "transparent" }}
                  aria-label={`Remove ${track.name}`}
                  onClick={() => onAddedAudioChange(addedAudio.filter(item => item.id !== track.id))}
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}

            <div className="hkc-audio-row">
              <Mic className="size-4 shrink-0" />
              <span className="hkc-audio-name">Voiceover</span>
              <button
                type="button"
                className={"hkc-chip" + (recordingVoice ? " is-active" : "")}
                disabled={!voiceoverAvailable}
                onClick={() => void toggleVoiceover()}
              >
                {recordingVoice ? "Recording…" : "Record"}
              </button>
            </div>
            {!voiceoverAvailable && (
              <p className="hkc-note">This browser does not expose a microphone to record a voiceover.</p>
            )}
          </>
        )}

        {tool === "save" && (
          <>
            <div className="hkc-panel-head">
              <span className="hkc-panel-title">Save to device</span>
            </div>
            <p className="hkc-row-hint">
              Exports the Clip with your trim, filter, effects, text, stickers, captions and audio
              already applied, then downloads it. The same file is what gets uploaded.
            </p>
            <button
              type="button"
              className="hkc-pill"
              style={{ marginTop: 12, width: "100%", justifyContent: "center", minHeight: 44 }}
              onClick={onSaveToDevice}
            >
              <Download className="size-4" />
              Save to device
            </button>
            <p className="hkc-note">
              <Gauge style={{ display: "inline", width: 13, height: 13, verticalAlign: "-2px" }} /> Exporting
              re-encodes in real time, so a 30 second Clip takes about 30 seconds.
            </p>
          </>
        )}
      </div>
    </>
  );
}

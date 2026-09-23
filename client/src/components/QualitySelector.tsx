interface QualitySelectorProps {
  currentQuality: string;
  onQualityChange: (quality: string) => void;
}

const qualities = ["Auto", "1080p", "720p", "480p", "360p"];

export default function QualitySelector({ currentQuality, onQualityChange }: QualitySelectorProps) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-gray-300">
      <span className="sr-only">Video quality</span>
      <select
        aria-label="Video quality"
        value={currentQuality}
        onChange={(event) => onQualityChange(event.target.value)}
        className="cursor-pointer rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-red-500"
      >
        {qualities.map((quality) => (
          <option key={quality} value={quality}>
            {quality}
          </option>
        ))}
      </select>
    </label>
  );
}

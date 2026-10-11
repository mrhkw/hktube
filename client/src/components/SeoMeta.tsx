import { useEffect } from "react";

interface SeoMetaProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
}

const DEFAULT_DESCRIPTION = "Watch and share high-quality videos on HKW.";
const DEFAULT_IMAGE = "https://hkw.vercel.app/brand/hkw-mark.webp";

function setMeta(selector: string, content: string) {
  const element = document.querySelector<HTMLMetaElement>(selector);
  if (element) element.setAttribute("content", content);
}

export default function SeoMeta({ title, description, image, url }: SeoMetaProps) {
  useEffect(() => {
    const resolvedDescription = description || DEFAULT_DESCRIPTION;
    const resolvedImage = image || DEFAULT_IMAGE;
    const resolvedUrl = url || window.location.href;

    document.title = `${title} - HKW`;
    setMeta('meta[name="description"]', resolvedDescription);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', resolvedDescription);
    setMeta('meta[property="og:image"]', resolvedImage);
    setMeta('meta[property="og:url"]', resolvedUrl);
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', resolvedDescription);
    setMeta('meta[name="twitter:image"]', resolvedImage);

    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", resolvedUrl);
  }, [title, description, image, url]);

  return null;
}

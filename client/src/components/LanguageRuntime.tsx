import { useEffect } from "react";
import { applyHkLanguage, applyHkTheme } from "@/components/ThemeManager";

const LANGUAGE_KEY = "hktube-language-code";
const THEME_KEY = "hktube-theme";

export const HKTUBE_ALL_LANGUAGES = [
  ["en","English","English"],["ur","Urdu","اردو"],["hi","Hindi","हिन्दी"],["ar","Arabic","العربية"],
  ["bn","Bengali","বাংলা"],["pa","Punjabi","ਪੰਜਾਬੀ"],["sd","Sindhi","سنڌي"],["ps","Pashto","پښتو"],["fa","Persian","فارسی"],
  ["gu","Gujarati","ગુજરાતી"],["mr","Marathi","मराठी"],["ne","Nepali","नेपाली"],["si","Sinhala","සිංහල"],["ta","Tamil","தமிழ்"],
  ["te","Telugu","తెలుగు"],["kn","Kannada","ಕನ್ನಡ"],["ml","Malayalam","മലയാളം"],["or","Odia","ଓଡ଼ିଆ"],["as","Assamese","অসমীয়া"],["mai","Maithili","मैथिली"],
  ["zh","Chinese","中文"],["yue","Cantonese","廣東話"],["ja","Japanese","日本語"],["ko","Korean","한국어"],["th","Thai","ไทย"],["vi","Vietnamese","Tiếng Việt"],
  ["id","Indonesian","Bahasa Indonesia"],["ms","Malay","Bahasa Melayu"],["fil","Filipino","Filipino"],["my","Burmese","မြန်မာ"],["km","Khmer","ខ្មែរ"],["lo","Lao","ລາວ"],
  ["tr","Turkish","Türkçe"],["az","Azerbaijani","Azərbaycan"],["kk","Kazakh","Қазақша"],["uz","Uzbek","O‘zbekcha"],["ky","Kyrgyz","Кыргызча"],["tk","Turkmen","Türkmençe"],
  ["ru","Russian","Русский"],["uk","Ukrainian","Українська"],["be","Belarusian","Беларуская"],["pl","Polish","Polski"],["cs","Czech","Čeština"],["sk","Slovak","Slovenčina"],
  ["sl","Slovenian","Slovenščina"],["hr","Croatian","Hrvatski"],["sr","Serbian","Српски"],["bs","Bosnian","Bosanski"],["mk","Macedonian","Македонски"],["bg","Bulgarian","Български"],
  ["ro","Romanian","Română"],["hu","Hungarian","Magyar"],["de","German","Deutsch"],["nl","Dutch","Nederlands"],["da","Danish","Dansk"],["sv","Swedish","Svenska"],
  ["no","Norwegian","Norsk"],["fi","Finnish","Suomi"],["is","Icelandic","Íslenska"],["et","Estonian","Eesti"],["lv","Latvian","Latviešu"],["lt","Lithuanian","Lietuvių"],
  ["fr","French","Français"],["es","Spanish","Español"],["pt","Portuguese","Português"],["it","Italian","Italiano"],["ca","Catalan","Català"],["eu","Basque","Euskara"],["gl","Galician","Galego"],
  ["el","Greek","Ελληνικά"],["he","Hebrew","עברית"],["sw","Swahili","Kiswahili"],["am","Amharic","አማርኛ"],["ha","Hausa","Hausa"],["yo","Yoruba","Yorùbá"],["ig","Igbo","Igbo"],
  ["zu","Zulu","isiZulu"],["af","Afrikaans","Afrikaans"],["so","Somali","Soomaali"],["tl","Tagalog","Tagalog"],
] as const;

const RTL_LANGUAGES = new Set(["ur","ar","fa","ps","sd","he"]);
const TRANSLATION_FALLBACK: Record<string, string> = {
  pa:"ur",sd:"ur",ps:"ur",fa:"ar",gu:"hi",mr:"hi",ne:"hi",si:"en",ta:"en",te:"en",kn:"en",ml:"en",or:"hi",as:"bn",mai:"hi",
  yue:"zh",ja:"zh",ko:"en",th:"en",vi:"en",ms:"id",fil:"en",my:"en",km:"en",lo:"en",az:"tr",kk:"ru",uz:"ru",ky:"ru",tk:"tr",
  uk:"en",be:"ru",pl:"en",cs:"en",sk:"en",sl:"en",hr:"en",sr:"en",bs:"en",mk:"en",bg:"en",ro:"en",hu:"en",nl:"de",da:"en",sv:"en",no:"en",fi:"en",is:"en",et:"en",lv:"en",lt:"en",it:"en",ca:"es",eu:"es",gl:"es",el:"en",he:"ar",sw:"en",am:"en",ha:"en",yo:"en",ig:"en",zu:"en",af:"en",so:"en",tl:"en"
};

function safeGet(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  try { return window.localStorage.getItem(key) || fallback; } catch { return fallback; }
}

function readLanguage() {
  const stored = safeGet(LANGUAGE_KEY, "en");
  return HKTUBE_ALL_LANGUAGES.some(item => item[0] === stored) ? stored : "en";
}

function syncLanguageOptions() {
  try {
    for (const select of document.querySelectorAll<HTMLSelectElement>("select")) {
      if (!Array.from(select.options).some(option => option.value === "ur" && /اردو/.test(option.textContent || ""))) continue;
      for (const [code, name, native] of HKTUBE_ALL_LANGUAGES) {
        if (Array.from(select.options).some(option => option.value === code)) continue;
        const option = document.createElement("option"); option.value = code; option.textContent = `${native} · ${name}`; select.appendChild(option);
      }
    }
  } catch { /* optional enhancement must never block the app */ }
}

function syncPreferences() {
  try {
    const language = readLanguage();
    const translationCode = TRANSLATION_FALLBACK[language] || language;
    try { applyHkLanguage(translationCode); } catch { /* keep core UI usable */ }
    try { applyHkTheme(safeGet(THEME_KEY, "violet")); } catch { /* keep core UI usable */ }
    document.documentElement.lang = language;
    document.documentElement.dir = RTL_LANGUAGES.has(language) ? "rtl" : "ltr";
    document.documentElement.dataset.hktubeLanguage = language;
    syncLanguageOptions();
  } catch { /* language runtime is non-essential */ }
}

export function LanguageRuntime() {
  useEffect(() => {
    syncPreferences();
    const onPreferenceChange = () => syncPreferences();
    window.addEventListener("hktube-language-change", onPreferenceChange);
    window.addEventListener("hktube-language-updated", onPreferenceChange);
    window.addEventListener("hktube-theme-change", onPreferenceChange);
    window.addEventListener("storage", onPreferenceChange);
    const interval = window.setInterval(syncPreferences, 1200);
    return () => { window.clearInterval(interval); window.removeEventListener("hktube-language-change", onPreferenceChange); window.removeEventListener("hktube-language-updated", onPreferenceChange); window.removeEventListener("hktube-theme-change", onPreferenceChange); window.removeEventListener("storage", onPreferenceChange); };
  }, []);
  return null;
}

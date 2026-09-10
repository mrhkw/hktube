import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

export const HKTUBE_THEMES = [
  { id: "violet", name: "Violet", accent: "#7c5cff" },
  { id: "blue", name: "Ocean Blue", accent: "#3b82f6" },
  { id: "cyan", name: "Cyan", accent: "#06b6d4" },
  { id: "teal", name: "Teal", accent: "#14b8a6" },
  { id: "green", name: "Emerald", accent: "#10b981" },
  { id: "lime", name: "Lime", accent: "#84cc16" },
  { id: "amber", name: "Amber", accent: "#f59e0b" },
  { id: "orange", name: "Orange", accent: "#f97316" },
  { id: "red", name: "Ruby", accent: "#ef4444" },
  { id: "pink", name: "Pink", accent: "#ec4899" },
  { id: "fuchsia", name: "Fuchsia", accent: "#d946ef" },
  { id: "indigo", name: "Indigo", accent: "#6366f1" },
] as const;

export const HKTUBE_LANGUAGES = [
  { code: "en", name: "English", native: "English" },
  { code: "ur", name: "Urdu", native: "اردو" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "ar", name: "Arabic", native: "العربية" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "zh", name: "Chinese", native: "中文" },
  { code: "fr", name: "French", native: "Français" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
] as const;

const UI_TRANSLATIONS: Record<string, Record<string, string>> = {
  ur: { Home: "ہوم", Shorts: "شارٹس", Create: "بنائیں", Feeds: "فیڈز", Profile: "پروفائل", Menu: "مینو", "Search videos...": "ویڈیوز تلاش کریں...", Notifications: "اطلاعات", Settings: "ترتیبات", "Long Video": "لمبی ویڈیو", Clip: "کلپ", Post: "پوسٹ", Upload: "اپ لوڈ", Videos: "ویڈیوز", Clips: "کلپس", Recommended: "تجویز کردہ", "Recommended videos": "تجویز کردہ ویڈیوز", Subscribers: "سبسکرائبرز", "Total views": "کل ویوز", Published: "شائع شدہ", "Edit profile": "پروفائل ایڈٹ کریں", Share: "شیئر", Studio: "اسٹوڈیو", Description: "تفصیل", "Save changes": "تبدیلیاں محفوظ کریں", Cancel: "منسوخ", "Playback & accessibility": "پلے بیک اور رسائی", "Autoplay Shorts": "شارٹس خود چلائیں", "Preferred quality": "پسندیدہ کوالٹی", "Captions by default": "کیپشن بطور ڈیفالٹ", "Data & notifications": "ڈیٹا اور اطلاعات", "Reduce media preload": "میڈیا پری لوڈ کم کریں", "Activity notifications": "سرگرمی کی اطلاعات", "Language & region": "زبان اور علاقہ", "App language": "ایپ کی زبان", Location: "مقام", "Theme colors": "تھیم رنگ", "Safety & app behavior": "حفاظت اور ایپ کا رویہ", "Family Mode": "فیملی موڈ", "Creator & advanced tools": "کریئیٹر اور ایڈوانسڈ ٹولز" },
  hi: { Home: "होम", Shorts: "शॉर्ट्स", Create: "बनाएं", Feeds: "फ़ीड", Profile: "प्रोफ़ाइल", Menu: "मेन्यू", "Search videos...": "वीडियो खोजें...", Notifications: "सूचनाएं", Settings: "सेटिंग्स", "Long Video": "लंबा वीडियो", Clip: "क्लिप", Post: "पोस्ट", Upload: "अपलोड", Videos: "वीडियो", Clips: "क्लिप्स", Recommended: "सुझाए गए", "Recommended videos": "सुझाए गए वीडियो", Subscribers: "सब्सक्राइबर", "Total views": "कुल व्यूज़", Published: "प्रकाशित", "Edit profile": "प्रोफ़ाइल संपादित करें", Share: "शेयर", Studio: "स्टूडियो", Description: "विवरण", "Save changes": "बदलाव सेव करें", Cancel: "रद्द करें", "Playback & accessibility": "प्लेबैक और सुलभता", "Autoplay Shorts": "शॉर्ट्स ऑटोप्ले", "Preferred quality": "पसंदीदा गुणवत्ता", "Captions by default": "डिफ़ॉल्ट कैप्शन", "Data & notifications": "डेटा और सूचनाएं", "Reduce media preload": "मीडिया प्रीलोड कम करें", "Activity notifications": "गतिविधि सूचनाएं", "Language & region": "भाषा और क्षेत्र", "App language": "ऐप की भाषा", Location: "स्थान", "Theme colors": "थीम रंग", "Safety & app behavior": "सुरक्षा और ऐप व्यवहार", "Family Mode": "फैमिली मोड", "Creator & advanced tools": "क्रिएटर और उन्नत टूल" },
  ar: { Home: "الرئيسية", Shorts: "شورتس", Create: "إنشاء", Feeds: "الخلاصات", Profile: "الملف الشخصي", Menu: "القائمة", "Search videos...": "البحث عن فيديوهات...", Notifications: "الإشعارات", Settings: "الإعدادات", "Long Video": "فيديو طويل", Clip: "مقطع", Post: "منشور", Upload: "رفع", Videos: "الفيديوهات", Clips: "المقاطع", Recommended: "مقترح", "Recommended videos": "فيديوهات مقترحة", Subscribers: "المشتركون", "Total views": "إجمالي المشاهدات", Published: "منشور", "Edit profile": "تعديل الملف الشخصي", Share: "مشاركة", Studio: "الاستوديو", Description: "الوصف", "Save changes": "حفظ التغييرات", Cancel: "إلغاء", "Playback & accessibility": "التشغيل وإمكانية الوصول", "Autoplay Shorts": "تشغيل المقاطع تلقائياً", "Preferred quality": "الجودة المفضلة", "Captions by default": "التسميات التوضيحية افتراضياً", "Data & notifications": "البيانات والإشعارات", "Reduce media preload": "تقليل التحميل المسبق", "Activity notifications": "إشعارات النشاط", "Language & region": "اللغة والمنطقة", "App language": "لغة التطبيق", Location: "الموقع", "Theme colors": "ألوان المظهر", "Safety & app behavior": "الأمان وسلوك التطبيق", "Family Mode": "وضع العائلة", "Creator & advanced tools": "أدوات المنشئ المتقدمة" },
  bn: { Home: "হোম", Shorts: "শর্টস", Create: "তৈরি করুন", Feeds: "ফিড", Profile: "প্রোফাইল", Menu: "মেনু", "Search videos...": "ভিডিও খুঁজুন...", Notifications: "বিজ্ঞপ্তি", Settings: "সেটিংস", "Long Video": "দীর্ঘ ভিডিও", Clip: "ক্লিপ", Post: "পোস্ট", Upload: "আপলোড", Videos: "ভিডিও", Clips: "ক্লিপস", Recommended: "প্রস্তাবিত", "Recommended videos": "প্রস্তাবিত ভিডিও", Subscribers: "সাবস্ক্রাইবার", "Total views": "মোট ভিউ", Published: "প্রকাশিত", "Edit profile": "প্রোফাইল সম্পাদনা", Share: "শেয়ার", Studio: "স্টুডিও", Description: "বিবরণ", "Save changes": "পরিবর্তন সংরক্ষণ", Cancel: "বাতিল", "Playback & accessibility": "প্লেব্যাক ও অ্যাক্সেসিবিলিটি", "Autoplay Shorts": "শর্টস অটোপ্লে", "Preferred quality": "পছন্দের মান", "Captions by default": "ডিফল্ট ক্যাপশন", "Data & notifications": "ডেটা ও বিজ্ঞপ্তি", "Reduce media preload": "মিডিয়া প্রিলোড কমান", "Activity notifications": "কার্যকলাপের বিজ্ঞপ্তি", "Language & region": "ভাষা ও অঞ্চল", "App language": "অ্যাপের ভাষা", Location: "অবস্থান", "Theme colors": "থিম রং", "Safety & app behavior": "নিরাপত্তা ও অ্যাপ আচরণ", "Family Mode": "ফ্যামিলি মোড", "Creator & advanced tools": "ক্রিয়েটর ও উন্নত টুল" },
  zh: { Home: "首页", Shorts: "短视频", Create: "创建", Feeds: "动态", Profile: "个人资料", Menu: "菜单", "Search videos...": "搜索视频...", Notifications: "通知", Settings: "设置", "Long Video": "长视频", Clip: "短片", Post: "帖子", Upload: "上传", Videos: "视频", Clips: "短片", Recommended: "推荐", "Recommended videos": "推荐视频", Subscribers: "订阅者", "Total views": "总观看次数", Published: "已发布", "Edit profile": "编辑资料", Share: "分享", Studio: "创作者工作室", Description: "描述", "Save changes": "保存更改", Cancel: "取消", "Playback & accessibility": "播放与无障碍", "Autoplay Shorts": "短视频自动播放", "Preferred quality": "首选画质", "Captions by default": "默认字幕", "Data & notifications": "数据与通知", "Reduce media preload": "减少媒体预加载", "Activity notifications": "活动通知", "Language & region": "语言和地区", "App language": "应用语言", Location: "地区", "Theme colors": "主题颜色", "Safety & app behavior": "安全与应用行为", "Family Mode": "家庭模式", "Creator & advanced tools": "创作者与高级工具" },
  fr: { Home: "Accueil", Shorts: "Shorts", Create: "Créer", Feeds: "Flux", Profile: "Profil", Menu: "Menu", "Search videos...": "Rechercher des vidéos...", Notifications: "Notifications", Settings: "Paramètres", "Long Video": "Vidéo longue", Clip: "Clip", Post: "Publication", Upload: "Importer", Videos: "Vidéos", Clips: "Clips", Recommended: "Recommandé", "Recommended videos": "Vidéos recommandées", Subscribers: "Abonnés", "Total views": "Vues totales", Published: "Publié", "Edit profile": "Modifier le profil", Share: "Partager", Studio: "Studio", Description: "Description", "Save changes": "Enregistrer", Cancel: "Annuler", "Playback & accessibility": "Lecture et accessibilité", "Autoplay Shorts": "Lecture automatique des Shorts", "Preferred quality": "Qualité préférée", "Captions by default": "Sous-titres par défaut", "Data & notifications": "Données et notifications", "Reduce media preload": "Réduire le préchargement", "Activity notifications": "Notifications d'activité", "Language & region": "Langue et région", "App language": "Langue de l'application", Location: "Lieu", "Theme colors": "Couleurs du thème", "Safety & app behavior": "Sécurité et comportement", "Family Mode": "Mode famille", "Creator & advanced tools": "Outils créateur avancés" },
  de: { Home: "Startseite", Shorts: "Shorts", Create: "Erstellen", Feeds: "Feeds", Profile: "Profil", Menu: "Menü", "Search videos...": "Videos suchen...", Notifications: "Benachrichtigungen", Settings: "Einstellungen", "Long Video": "Langes Video", Clip: "Clip", Post: "Beitrag", Upload: "Hochladen", Videos: "Videos", Clips: "Clips", Recommended: "Empfohlen", "Recommended videos": "Empfohlene Videos", Subscribers: "Abonnenten", "Total views": "Aufrufe gesamt", Published: "Veröffentlicht", "Edit profile": "Profil bearbeiten", Share: "Teilen", Studio: "Studio", Description: "Beschreibung", "Save changes": "Änderungen speichern", Cancel: "Abbrechen", "Playback & accessibility": "Wiedergabe & Barrierefreiheit", "Autoplay Shorts": "Shorts automatisch abspielen", "Preferred quality": "Bevorzugte Qualität", "Captions by default": "Untertitel standardmäßig", "Data & notifications": "Daten & Benachrichtigungen", "Reduce media preload": "Medienvorladung reduzieren", "Activity notifications": "Aktivitätsbenachrichtigungen", "Language & region": "Sprache & Region", "App language": "App-Sprache", Location: "Standort", "Theme colors": "Designfarben", "Safety & app behavior": "Sicherheit & App-Verhalten", "Family Mode": "Familienmodus", "Creator & advanced tools": "Erweiterte Creator-Tools" },
  es: { Home: "Inicio", Shorts: "Shorts", Create: "Crear", Feeds: "Feeds", Profile: "Perfil", Menu: "Menú", "Search videos...": "Buscar vídeos...", Notifications: "Notificaciones", Settings: "Configuración", "Long Video": "Vídeo largo", Clip: "Clip", Post: "Publicación", Upload: "Subir", Videos: "Vídeos", Clips: "Clips", Recommended: "Recomendado", "Recommended videos": "Vídeos recomendados", Subscribers: "Suscriptores", "Total views": "Vistas totales", Published: "Publicado", "Edit profile": "Editar perfil", Share: "Compartir", Studio: "Estudio", Description: "Descripción", "Save changes": "Guardar cambios", Cancel: "Cancelar", "Playback & accessibility": "Reproducción y accesibilidad", "Autoplay Shorts": "Reproducción automática de Shorts", "Preferred quality": "Calidad preferida", "Captions by default": "Subtítulos predeterminados", "Data & notifications": "Datos y notificaciones", "Reduce media preload": "Reducir precarga de medios", "Activity notifications": "Notificaciones de actividad", "Language & region": "Idioma y región", "App language": "Idioma de la app", Location: "Ubicación", "Theme colors": "Colores del tema", "Safety & app behavior": "Seguridad y comportamiento", "Family Mode": "Modo familiar", "Creator & advanced tools": "Herramientas avanzadas para creadores" },
  pt: { Home: "Início", Shorts: "Shorts", Create: "Criar", Feeds: "Feeds", Profile: "Perfil", Menu: "Menu", "Search videos...": "Pesquisar vídeos...", Notifications: "Notificações", Settings: "Configurações", "Long Video": "Vídeo longo", Clip: "Clipe", Post: "Postagem", Upload: "Enviar", Videos: "Vídeos", Clips: "Clipes", Recommended: "Recomendado", "Recommended videos": "Vídeos recomendados", Subscribers: "Inscritos", "Total views": "Visualizações totais", Published: "Publicado", "Edit profile": "Editar perfil", Share: "Compartilhar", Studio: "Estúdio", Description: "Descrição", "Save changes": "Salvar alterações", Cancel: "Cancelar", "Playback & accessibility": "Reprodução e acessibilidade", "Autoplay Shorts": "Reprodução automática de Shorts", "Preferred quality": "Qualidade preferida", "Captions by default": "Legendas padrão", "Data & notifications": "Dados e notificações", "Reduce media preload": "Reduzir pré-carregamento", "Activity notifications": "Notificações de atividade", "Language & region": "Idioma e região", "App language": "Idioma do app", Location: "Localização", "Theme colors": "Cores do tema", "Safety & app behavior": "Segurança e comportamento", "Family Mode": "Modo família", "Creator & advanced tools": "Ferramentas avançadas para criadores" },
  tr: { Home: "Ana Sayfa", Shorts: "Shorts", Create: "Oluştur", Feeds: "Akışlar", Profile: "Profil", Menu: "Menü", "Search videos...": "Video ara...", Notifications: "Bildirimler", Settings: "Ayarlar", "Long Video": "Uzun Video", Clip: "Klip", Post: "Gönderi", Upload: "Yükle", Videos: "Videolar", Clips: "Klipler", Recommended: "Önerilen", "Recommended videos": "Önerilen videolar", Subscribers: "Aboneler", "Total views": "Toplam görüntüleme", Published: "Yayınlandı", "Edit profile": "Profili düzenle", Share: "Paylaş", Studio: "Stüdyo", Description: "Açıklama", "Save changes": "Değişiklikleri kaydet", Cancel: "İptal", "Playback & accessibility": "Oynatma ve erişilebilirlik", "Autoplay Shorts": "Shorts otomatik oynat", "Preferred quality": "Tercih edilen kalite", "Captions by default": "Varsayılan altyazılar", "Data & notifications": "Veri ve bildirimler", "Reduce media preload": "Medya ön yüklemesini azalt", "Activity notifications": "Etkinlik bildirimleri", "Language & region": "Dil ve bölge", "App language": "Uygulama dili", Location: "Konum", "Theme colors": "Tema renkleri", "Safety & app behavior": "Güvenlik ve uygulama davranışı", "Family Mode": "Aile Modu", "Creator & advanced tools": "Gelişmiş üretici araçları" },
  id: { Home: "Beranda", Shorts: "Shorts", Create: "Buat", Feeds: "Feed", Profile: "Profil", Menu: "Menu", "Search videos...": "Cari video...", Notifications: "Notifikasi", Settings: "Setelan", "Long Video": "Video panjang", Clip: "Klip", Post: "Postingan", Upload: "Unggah", Videos: "Video", Clips: "Klip", Recommended: "Direkomendasikan", "Recommended videos": "Video yang direkomendasikan", Subscribers: "Pelanggan", "Total views": "Total penayangan", Published: "Dipublikasikan", "Edit profile": "Edit profil", Share: "Bagikan", Studio: "Studio", Description: "Deskripsi", "Save changes": "Simpan perubahan", Cancel: "Batal", "Playback & accessibility": "Pemutaran & aksesibilitas", "Autoplay Shorts": "Putar otomatis Shorts", "Preferred quality": "Kualitas pilihan", "Captions by default": "Teks default", "Data & notifications": "Data & notifikasi", "Reduce media preload": "Kurangi pramuat media", "Activity notifications": "Notifikasi aktivitas", "Language & region": "Bahasa & wilayah", "App language": "Bahasa aplikasi", Location: "Lokasi", "Theme colors": "Warna tema", "Safety & app behavior": "Keamanan & perilaku aplikasi", "Family Mode": "Mode keluarga", "Creator & advanced tools": "Alat kreator lanjutan" },
};

export function applyHkTheme(themeId: string) {
  const theme = HKTUBE_THEMES.find(item => item.id === themeId) || HKTUBE_THEMES[0];
  document.documentElement.dataset.hktubeTheme = theme.id;
  document.documentElement.style.setProperty("--hktube-accent", theme.accent);
  document.documentElement.style.setProperty("--hktube-accent-soft", `${theme.accent}22`);
  document.documentElement.style.setProperty("--hktube-accent-ring", `${theme.accent}55`);
  localStorage.setItem("hktube-theme", theme.id);
}

function translatePage(code: string) {
  const map = UI_TRANSLATIONS[code] || {};
  const translateTextNode = (node: Text) => {
    const parent = node.parentElement;
    if (!parent || ["SCRIPT", "STYLE", "TEXTAREA"].includes(parent.tagName)) return;
    const original = node.parentElement?.dataset.hktubeOriginalText ?? node.nodeValue ?? "";
    if (!node.parentElement?.dataset.hktubeOriginalText) node.parentElement!.dataset.hktubeOriginalText = original;
    const trimmed = original.trim();
    if (!trimmed || !map[trimmed]) return;
    const leading = original.match(/^\s*/)?.[0] || "";
    const trailing = original.match(/\s*$/)?.[0] || "";
    node.nodeValue = `${leading}${map[trimmed]}${trailing}`;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null; while ((node = walker.nextNode())) nodes.push(node as Text);
  nodes.forEach(translateTextNode);
  document.querySelectorAll<HTMLElement>("[placeholder],[title],[aria-label]").forEach(el => {
    for (const attr of ["placeholder", "title", "aria-label"] as const) {
      const value = el.getAttribute(attr); if (value && map[value]) { el.dataset[`hktubeOriginal${attr}`] = el.dataset[`hktubeOriginal${attr}`] || value; el.setAttribute(attr, map[value]); }
    }
  });
}

export function applyHkLanguage(code: string) {
  const language = HKTUBE_LANGUAGES.find(item => item.code === code) || HKTUBE_LANGUAGES[0];
  document.documentElement.lang = language.code;
  document.documentElement.dir = language.code === "ur" || language.code === "ar" ? "rtl" : "ltr";
  localStorage.setItem("hktube-language-code", language.code);
  translatePage(language.code);
  window.dispatchEvent(new CustomEvent("hktube-language-updated", { detail: language.code }));
}

export function ThemeManager() {
  const { user } = useAuth();
  const channels = trpc.channels.mine.useQuery(undefined, { enabled: Boolean(user), staleTime: 60000 });
  const createChannel = trpc.channels.create.useMutation();
  const provisioned = useRef(false);
  const suggestedHandle = useMemo(() => {
    const base = (user?.name || "creator").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 48) || "creator";
    return `${base}_${user?.id ?? "hktube"}`.slice(0, 64).replace(/_+$/, "") || "creator_hktube";
  }, [user?.name, user?.id]);
  useEffect(() => {
    const savedTheme = localStorage.getItem("hktube-theme") || "violet";
    const savedLanguage = localStorage.getItem("hktube-language-code") || localStorage.getItem("hktube-language")?.slice(0, 2).toLowerCase() || "en";
    applyHkTheme(savedTheme); applyHkLanguage(savedLanguage);
    const observer = new MutationObserver(() => translatePage(localStorage.getItem("hktube-language-code") || "en"));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!user || channels.isLoading || channels.isError || channels.data?.length || provisioned.current || createChannel.isPending) return;
    provisioned.current = true;
    createChannel.mutate({ handle: suggestedHandle, displayName: user.name?.trim() || "HkTube Creator", description: "" }, {
      onSuccess: () => { void channels.refetch(); },
      onError: error => { provisioned.current = false; if (!/already exists|duplicate|unique/i.test(error.message)) console.warn("[Channel] Auto-provision failed:", error.message); },
    });
  }, [user, channels.isLoading, channels.isError, channels.data, createChannel.isPending, suggestedHandle]);
  return <style>{`\n    :root { --hktube-accent:#7c5cff; --hktube-accent-soft:#7c5cff22; --hktube-accent-ring:#7c5cff55; }\n    body [class*="bg-violet-500"] { background-color:var(--hktube-accent)!important; }\n    body [class*="text-violet-300"], body [class*="text-violet-200"], body [class*="text-violet-100"] { color:var(--hktube-accent)!important; }\n    body [class*="border-violet-400"], body [class*="border-violet-300"] { border-color:var(--hktube-accent-ring)!important; }\n    body [class*="from-violet-500"] { --tw-gradient-from:var(--hktube-accent)!important; }\n    body [class*="to-violet-600"] { --tw-gradient-to:var(--hktube-accent)!important; }\n    body [class*="focus-visible:border-violet-400"]:focus-visible { border-color:var(--hktube-accent)!important; }\n    @media (max-width: 767px) { nav[aria-label="Mobile navigation"] a:first-child svg { width:24px!important; height:24px!important; } }\n  `}</style>;
}

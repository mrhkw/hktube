import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export const LANGUAGES = [
  ['en', 'English'], ['hi', 'हिन्दी'], ['ur', 'اردو'], ['es', 'Español'], ['fr', 'Français'], ['ar', 'العربية'],
  ['pt', 'Português'], ['id', 'Bahasa Indonesia'], ['ja', '日本語'], ['ko', '한국어'], ['tr', 'Türkçe'], ['de', 'Deutsch'],
  ['ru', 'Русский'], ['it', 'Italiano'], ['th', 'ไทย'], ['vi', 'Tiếng Việt'], ['bn', 'বাংলা'], ['ta', 'தமிழ்'],
  ['te', 'తెలుగు'], ['ms', 'Bahasa Melayu'], ['fil', 'Filipino'], ['nl', 'Nederlands'], ['pl', 'Polski'], ['sv', 'Svenska'],
] as const

export type LanguageCode = typeof LANGUAGES[number][0]
const rtlLanguages = new Set<LanguageCode>(['ar', 'ur'])

const translations: Partial<Record<LanguageCode, Record<string, string>>> = {
  hi: { Settings: 'सेटिंग्स', 'Theme & Display': 'थीम और डिस्प्ले', 'Video Playback': 'वीडियो प्लेबैक', Account: 'खाता', 'About & Support': 'बारे में और सहायता', 'Log Out': 'लॉग आउट', 'Save Preferences': 'प्राथमिकताएँ सहेजें', 'Language': 'भाषा', 'Welcome back': 'वापसी पर स्वागत है', 'Create account': 'खाता बनाएँ', 'Sign In': 'साइन इन', 'Sign Up': 'साइन अप' },
  ur: { Settings: 'ترتیبات', 'Theme & Display': 'تھیم اور ڈسپلے', 'Video Playback': 'ویڈیو پلے بیک', Account: 'اکاؤنٹ', 'About & Support': 'بارے میں اور مدد', 'Log Out': 'لاگ آؤٹ', 'Save Preferences': 'ترجیحات محفوظ کریں', Language: 'زبان', 'Welcome back': 'خوش آمدید', 'Create account': 'اکاؤنٹ بنائیں', 'Sign In': 'سائن اِن', 'Sign Up': 'سائن اَپ' },
  es: { Settings: 'Configuración', 'Theme & Display': 'Tema y pantalla', 'Video Playback': 'Reproducción de vídeo', Account: 'Cuenta', 'About & Support': 'Acerca de y ayuda', 'Log Out': 'Cerrar sesión', 'Save Preferences': 'Guardar preferencias', Language: 'Idioma', 'Welcome back': 'Bienvenido de nuevo', 'Create account': 'Crear cuenta', 'Sign In': 'Iniciar sesión', 'Sign Up': 'Registrarse' },
  fr: { Settings: 'Paramètres', 'Theme & Display': 'Thème et affichage', 'Video Playback': 'Lecture vidéo', Account: 'Compte', 'About & Support': 'À propos et assistance', 'Log Out': 'Se déconnecter', 'Save Preferences': 'Enregistrer les préférences', Language: 'Langue', 'Welcome back': 'Bon retour', 'Create account': 'Créer un compte', 'Sign In': 'Se connecter', 'Sign Up': "S'inscrire" },
  de: { Settings: 'Einstellungen', 'Theme & Display': 'Theme und Anzeige', 'Video Playback': 'Videowiedergabe', Account: 'Konto', 'About & Support': 'Über und Hilfe', 'Log Out': 'Abmelden', 'Save Preferences': 'Einstellungen speichern', Language: 'Sprache', 'Welcome back': 'Willkommen zurück', 'Create account': 'Konto erstellen', 'Sign In': 'Anmelden', 'Sign Up': 'Registrieren' },
  ar: { Settings: 'الإعدادات', 'Theme & Display': 'المظهر والعرض', 'Video Playback': 'تشغيل الفيديو', Account: 'الحساب', 'About & Support': 'حول ودعم', 'Log Out': 'تسجيل الخروج', 'Save Preferences': 'حفظ التفضيلات', Language: 'اللغة', 'Welcome back': 'مرحباً بعودتك', 'Create account': 'إنشاء حساب', 'Sign In': 'تسجيل الدخول', 'Sign Up': 'إنشاء حساب' },
  pt: { Settings: 'Configurações', 'Theme & Display': 'Tema e exibição', 'Video Playback': 'Reprodução de vídeo', Account: 'Conta', 'About & Support': 'Sobre e suporte', 'Log Out': 'Sair', 'Save Preferences': 'Salvar preferências', Language: 'Idioma', 'Welcome back': 'Bem-vindo de volta', 'Create account': 'Criar conta', 'Sign In': 'Entrar', 'Sign Up': 'Cadastrar' },
  ja: { Settings: '設定', 'Theme & Display': 'テーマと表示', 'Video Playback': '動画再生', Account: 'アカウント', 'About & Support': '概要とサポート', 'Log Out': 'ログアウト', 'Save Preferences': '設定を保存', Language: '言語', 'Welcome back': 'おかえりなさい', 'Create account': 'アカウントを作成', 'Sign In': 'ログイン', 'Sign Up': '登録' },
  ko: { Settings: '설정', 'Theme & Display': '테마 및 표시', 'Video Playback': '동영상 재생', Account: '계정', 'About & Support': '정보 및 지원', 'Log Out': '로그아웃', 'Save Preferences': '환경설정 저장', Language: '언어', 'Welcome back': '다시 오신 것을 환영합니다', 'Create account': '계정 만들기', 'Sign In': '로그인', 'Sign Up': '가입' },
  tr: { Settings: 'Ayarlar', 'Theme & Display': 'Tema ve Görüntü', 'Video Playback': 'Video Oynatma', Account: 'Hesap', 'About & Support': 'Hakkında ve Destek', 'Log Out': 'Çıkış Yap', 'Save Preferences': 'Tercihleri Kaydet', Language: 'Dil', 'Welcome back': 'Tekrar hoş geldiniz', 'Create account': 'Hesap oluştur', 'Sign In': 'Giriş yap', 'Sign Up': 'Kayıt ol' },
  ru: { Settings: 'Настройки', 'Theme & Display': 'Тема и экран', 'Video Playback': 'Воспроизведение видео', Account: 'Аккаунт', 'About & Support': 'О проекте и поддержка', 'Log Out': 'Выйти', 'Save Preferences': 'Сохранить настройки', Language: 'Язык', 'Welcome back': 'С возвращением', 'Create account': 'Создать аккаунт', 'Sign In': 'Войти', 'Sign Up': 'Регистрация' },
  it: { Settings: 'Impostazioni', 'Theme & Display': 'Tema e display', 'Video Playback': 'Riproduzione video', Account: 'Account', 'About & Support': 'Info e assistenza', 'Log Out': 'Esci', 'Save Preferences': 'Salva preferenze', Language: 'Lingua', 'Welcome back': 'Bentornato', 'Create account': 'Crea account', 'Sign In': 'Accedi', 'Sign Up': 'Registrati' },
}

interface LanguageContextValue { language: LanguageCode; setLanguage: (language: LanguageCode) => void; t: (key: string) => string; isRTL: boolean }
const LanguageContext = createContext<LanguageContextValue | null>(null)

function detectLanguage(): LanguageCode {
  const saved = typeof window !== 'undefined' ? localStorage.getItem('hktube-language') : null
  if (LANGUAGES.some(([code]) => code === saved)) return saved as LanguageCode
  const browserLanguage = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en'
  return LANGUAGES.some(([code]) => code === browserLanguage) ? browserLanguage as LanguageCode : 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(detectLanguage)
  const setLanguage = useCallback((next: LanguageCode) => { setLanguageState(next); localStorage.setItem('hktube-language', next) }, [])
  const isRTL = rtlLanguages.has(language)
  useEffect(() => { document.documentElement.lang = language; document.documentElement.dir = isRTL ? 'rtl' : 'ltr' }, [language, isRTL])
  const t = useCallback((key: string) => translations[language]?.[key] ?? key, [language])
  const value = useMemo(() => ({ language, setLanguage, t, isRTL }), [language, setLanguage, t, isRTL])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}

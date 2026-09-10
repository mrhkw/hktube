import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InstallAppPrompt } from "@/components/InstallAppPrompt";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

const Home = lazy(() => import("@/pages/Home"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Menu = lazy(() => import("@/pages/Menu"));
const Settings = lazy(() => import("@/pages/Settings"));
const AdSettings = lazy(() => import("@/pages/AdSettings"));
const LegalPage = lazy(() => import("@/pages/Legal").then(m => ({ default: m.LegalPage })));
const Contact = lazy(() => import("@/pages/Contact"));
const About = lazy(() => import("@/pages/About"));
const Help = lazy(() => import("@/pages/Help"));
const DeleteAccount = lazy(() => import("@/pages/DeleteAccount"));
const Impressum = lazy(() => import("@/pages/Impressum"));
const CreateChannel = lazy(() => import("@/pages/CreateChannel"));
const SearchResults = lazy(() => import("@/pages/SearchResults"));
const Upload = lazy(() => import("@/pages/Upload"));
const VideoCollection = lazy(() => import("@/pages/VideoCollection").then(m => ({ default: m.VideoCollection })));
const WatchVideo = lazy(() => import("@/pages/WatchVideo"));
const Profile = lazy(() => import("@/pages/Profile"));
const Auth = lazy(() => import("@/pages/Auth"));
const PlatformSection = lazy(() => import("@/pages/PlatformSection").then(m => ({ default: m.PlatformSection })));
const AlgorithmDashboard = lazy(() => import("@/pages/AlgorithmDashboard"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const CreatorAI = lazy(() => import("@/pages/CreatorAI"));
const Wallet = lazy(() => import("@/pages/Wallet"));
const PublicChannel = lazy(() => import("@/pages/PublicChannel"));
const Monetization = lazy(() => import("@/pages/Monetization"));

function RouteFallback() {
  return <div className="grid min-h-[45vh] place-items-center"><div className="rounded-full border border-zinc-200 bg-white/90 px-4 py-2 text-sm font-semibold text-zinc-600 shadow-sm">Loading HkTube…</div></div>;
}

function Router() {
  return <Suspense fallback={<RouteFallback />}><Switch>
    <Route path="/" component={Home} /><Route path="/home" component={Home} /><Route path="/index.html" component={Home} /><Route path="/app" component={Home} />
    <Route path="/shorts">{() => <VideoCollection kind="shorts" />}</Route><Route path="/trending">{() => <VideoCollection kind="trending" />}</Route>
    <Route path="/subscriptions">{() => <PlatformSection kind="subscriptions" />}</Route><Route path="/library">{() => <PlatformSection kind="library" />}</Route><Route path="/posts">{() => <PlatformSection kind="posts" />}</Route><Route path="/notifications">{() => <PlatformSection kind="notifications" />}</Route><Route path="/playlists">{() => <PlatformSection kind="playlists" />}</Route><Route path="/history">{() => <PlatformSection kind="history" />}</Route><Route path="/studio">{() => <PlatformSection kind="studio" />}</Route><Route path="/studio/ai" component={CreatorAI} /><Route path="/algorithm" component={AlgorithmDashboard} /><Route path="/admin" component={AdminDashboard} />
    <Route path="/profile" component={Profile} /><Route path="/channel/:handle" component={PublicChannel} /><Route path="/auth" component={Auth} /><Route path="/watch/:id" component={WatchVideo} /><Route path="/search" component={SearchResults} /><Route path="/upload" component={Upload} /><Route path="/menu" component={Menu} /><Route path="/settings" component={Settings} /><Route path="/studio/settings" component={Settings} /><Route path="/settings/ads" component={AdSettings} /><Route path="/wallet" component={Wallet} /><Route path="/monetization" component={Monetization} />
    <Route path="/help" component={Help} /><Route path="/delete-account" component={DeleteAccount} /><Route path="/privacy">{() => <LegalPage kind="privacy" />}</Route><Route path="/terms">{() => <LegalPage kind="terms" />}</Route><Route path="/cookies">{() => <LegalPage kind="cookies" />}</Route><Route path="/community">{() => <LegalPage kind="community" />}</Route><Route path="/advertising">{() => <LegalPage kind="advertising" />}</Route><Route path="/impressum" component={Impressum} /><Route path="/contact" component={Contact} /><Route path="/about" component={About} /><Route path="/channel/create" component={CreateChannel} /><Route path="/404" component={NotFound} /><Route component={NotFound} />
  </Switch></Suspense>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light" switchable><TooltipProvider><Toaster /><Router /><InstallAppPrompt /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}

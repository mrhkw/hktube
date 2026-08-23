import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Menu from "@/pages/Menu";
import Settings from "@/pages/Settings";
import { LegalPage } from "@/pages/Legal";
import Contact from "@/pages/Contact";
import About from "@/pages/About";
import CreateChannel from "@/pages/CreateChannel";
import SearchResults from "@/pages/SearchResults";
import Upload from "@/pages/Upload";
import { VideoCollection } from "@/pages/VideoCollection";
import WatchVideo from "@/pages/WatchVideo";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import HkTubeUI from "./pages/HkTubeUI";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import { PlatformSection } from "./pages/PlatformSection";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={HkTubeUI} />
      <Route path={"/app"} component={Home} />
      <Route path={"/shorts"}>{() => <VideoCollection kind="shorts" />}</Route>
      <Route path={"/trending"}>{() => <VideoCollection kind="trending" />}</Route>
      <Route path={"/subscriptions"}>{() => <PlatformSection kind="subscriptions" />}</Route>
      <Route path={"/library"}>{() => <PlatformSection kind="library" />}</Route>
      <Route path={"/posts"}>{() => <PlatformSection kind="posts" />}</Route>
      <Route path={"/notifications"}>{() => <PlatformSection kind="notifications" />}</Route>
      <Route path={"/playlists"}>{() => <PlatformSection kind="playlists" />}</Route>
      <Route path={"/history"}>{() => <PlatformSection kind="history" />}</Route>
      <Route path={"/studio"}>{() => <PlatformSection kind="studio" />}</Route>
      <Route path={"/profile"} component={Profile} />
      <Route path={"/auth"} component={Auth} />
      <Route path={"/watch/:id"} component={WatchVideo} />
      <Route path={"/search"} component={SearchResults} />
      <Route path={"/upload"} component={Upload} />
      <Route path={"/menu"} component={Menu} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/privacy"}>{() => <LegalPage kind="privacy" />}</Route>
      <Route path={"/terms"}>{() => <LegalPage kind="terms" />}</Route>
      <Route path={"/cookies"}>{() => <LegalPage kind="cookies" />}</Route>
      <Route path={"/community"}>{() => <LegalPage kind="community" />}</Route>
      <Route path={"/advertising"}>{() => <LegalPage kind="advertising" />}</Route>
      <Route path={"/contact"} component={Contact} />
      <Route path={"/about"} component={About} />
      <Route path={"/channel/create"} component={CreateChannel} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

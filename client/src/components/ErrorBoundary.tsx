import { cn } from "@/lib/utils";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(): State { return { hasError: true }; }
  componentDidCatch(error: Error, info: { componentStack: string | null }) {
    console.error("[HkTube] Unhandled UI error", error, info);
  }
  private retry = () => this.setState({ hasError: false });
  private goHome = () => window.location.assign("/");
  render() {
    if (this.state.hasError) return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <section role="alert" className="flex w-full max-w-md flex-col items-center rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <AlertTriangle size={44} className="mb-5 text-destructive" aria-hidden="true" />
          <h1 className="text-xl font-semibold">HkTube had a temporary problem</h1>
          <p className="mt-2 text-sm text-muted-foreground">Try again, or return to Home.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={this.retry} className={cn("inline-flex items-center gap-2 rounded-lg px-4 py-2", "bg-primary text-primary-foreground hover:opacity-90")}><RotateCcw size={16} aria-hidden="true" />Try again</button>
            <button type="button" onClick={this.goHome} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 hover:bg-muted"><Home size={16} aria-hidden="true" />Home</button>
          </div>
        </section>
      </main>
    );
    return this.props.children;
  }
}
export default ErrorBoundary;

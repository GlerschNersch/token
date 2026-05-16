import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh flex items-center justify-center p-6 bg-[#050507] text-slate-200 font-sans">
          <div className="max-w-md w-full space-y-8 text-center animate-in fade-in zoom-in duration-300">
            <div className="size-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto ring-8 ring-destructive/5">
              <AlertCircle className="size-10 text-destructive" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-display font-bold tracking-tight text-white">Something went wrong</h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                The application encountered a critical error. This is usually caused by missing data or a temporary connection issue.
              </p>
            </div>

            {this.state.error && (
              <div className="p-4 rounded-xl bg-black/40 border border-white/10 text-left overflow-auto max-h-40">
                <code className="text-[10px] font-mono text-destructive/80 block leading-normal break-all">
                  {this.state.error.name}: {this.state.error.message}
                </code>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-4">
              <Button 
                onClick={() => window.location.reload()} 
                className="w-full gap-2 h-12 font-mono uppercase tracking-wider"
              >
                <RefreshCw className="size-4" />
                Reload Application
              </Button>
              <Button 
                variant="ghost"
                onClick={() => {
                   window.location.hash = "#/";
                   window.location.reload();
                }}
                className="w-full gap-2 h-12 text-slate-400 hover:text-white"
              >
                <Home className="size-4" />
                Return to Dashboard
              </Button>
            </div>

            <div className="pt-8 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-600">
              Cabinet Bridge v1.4.1 · Error Boundary Active
            </div>
          </div>
        </div>
      );
    }

    return this.children;
  }
}

"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const isChunkError =
      error?.name === "ChunkLoadError" ||
      error?.message?.includes("Loading chunk") ||
      error?.message?.includes("ChunkLoadError");
    if (isChunkError && typeof window !== "undefined") {
      try {
        const key = "__rbm_chunk_reload_ts";
        const last = parseInt(sessionStorage.getItem(key) || "0", 10);
        const now = Date.now();
        if (now - last > 15000) {
          sessionStorage.setItem(key, String(now));
          window.location.reload();
        }
      } catch {
        // Ignore storage errors
      }
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="text-4xl font-mono font-bold text-rose-400">Error</div>
        <h1 className="text-lg font-bold">Something went wrong</h1>
        <p className="text-xs text-slate-400">
          An error occurred while loading this dashboard view.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all"
        >
          Reload Dashboard
        </button>
      </div>
    </div>
  );
}

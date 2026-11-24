"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] grid place-items-center px-6">
      <div className="max-w-sm text-center">
        <p className="text-sm font-semibold">Something went wrong</p>
        <p className="text-xs text-white/40 mt-2 break-words">
          {error.message || "Unexpected error"}
        </p>
        <button
          onClick={reset}
          className="mt-5 bg-nexus-green text-black text-sm font-semibold px-4 py-2.5 rounded-xl press"
        >
          Try again
        </button>
        <a
          href="/"
          className="block mt-3 text-xs text-white/40 underline underline-offset-4"
        >
          Back to Send
        </a>
      </div>
    </div>
  );
}

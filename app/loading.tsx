export default function Loading() {
  return (
    <div className="space-y-4 animate-fade-in" aria-busy="true" aria-label="Loading">
      <div className="h-6 w-28 rounded-lg bg-white/5 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-white/[0.04] animate-pulse" />
        ))}
      </div>
      <div className="h-56 rounded-2xl bg-white/[0.03] animate-pulse" />
    </div>
  );
}

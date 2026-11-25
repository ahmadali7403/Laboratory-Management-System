// Shown immediately while any page inside the app shell streams in, so a click on a
// module gives instant visual feedback instead of a frozen screen.
export default function AppLoading() {
  return (
    <div className="space-y-5" role="status" aria-live="polite" aria-label="Loading">
      <div className="space-y-2">
        <div className="skeleton h-7 w-56" />
        <div className="skeleton h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-24" />
        ))}
      </div>
      <div className="skeleton h-72" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

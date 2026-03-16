// Reusable tappable prompt for empty states across the app.
// Renders as a prominent navy pill with a + icon to encourage action.
// Used wherever the user needs a nudge to log data.

interface EmptyStatePromptProps {
  label: string;
  onTap: () => void;
}

export default function EmptyStatePrompt({ label, onTap }: EmptyStatePromptProps) {
  return (
    <div className="flex justify-center">
      <button
        onClick={onTap}
        className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold hover:opacity-70 transition-opacity border"
        style={{ color: 'var(--color-navy)', borderColor: 'var(--color-navy)', backgroundColor: 'transparent' }}
      >
        {/* Plus icon */}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {label}
      </button>
    </div>
  );
}

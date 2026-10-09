import { cx } from "./cx";

export interface AvatarProps {
  /** Two letters, for example "EH". */
  initials: string;
  /** Diameter in px. Default 40. */
  size?: number;
  /** Orange ring: only for the one focused person on screen. */
  focused?: boolean;
  className?: string;
  title?: string;
}

/** Initials in a circle with a 1.5px ring. No photos, no generated faces. */
export function Avatar({ initials, size = 40, focused, className, title }: AvatarProps) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-surface-1 font-display font-bold text-fg-1 transition-[border-color] duration-[120ms]",
        className,
      )}
      style={{
        width: size,
        height: size,
        border: `1.5px solid ${focused ? "var(--orange)" : "var(--teal)"}`,
        fontSize: Math.round(size * 0.36),
        letterSpacing: "0.01em",
      }}
    >
      {initials}
    </span>
  );
}

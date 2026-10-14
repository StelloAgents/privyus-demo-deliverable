import type { LucideIcon } from "lucide-react";
import { cx } from "./cx";

export interface IconRingProps {
  icon: LucideIcon;
  /** Diameter in px. Default 40. */
  size?: number;
  /** Icon size in px. Default 18 (lists). */
  iconSize?: number;
  focused?: boolean;
  className?: string;
}

/** An icon inside a teal ring: the icon form of the avatar. */
export function IconRing({ icon: Icon, size = 40, iconSize = 18, focused, className }: IconRingProps) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-surface-1",
        focused ? "text-fg-1" : "text-teal",
        className,
      )}
      style={{ width: size, height: size, border: `1.5px solid ${focused ? "var(--orange)" : "var(--teal)"}` }}
    >
      <Icon size={iconSize} strokeWidth={1.5} />
    </span>
  );
}

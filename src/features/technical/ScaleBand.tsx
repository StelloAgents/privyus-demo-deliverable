import { cx } from "@/components/ui/cx";
import { HARD_THINGS, SCALE, SCALE_SECONDARY, type ScaleFigure } from "./content";
import { Note, Surface } from "./Section";

const DECADES = 9;

/** The scale band: order-of-magnitude figures, each with a decade meter (10^1 to 10^9). */
export function ScaleBand() {
  return (
    <div className="flex flex-col gap-4">
      <Surface className="overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          {SCALE.map((s, i) => (
            <ScaleCell key={s.what} s={s} first={i === 0} />
          ))}
        </div>
        <div className="flex flex-col gap-2 border-t border-line px-6 py-3 lg:flex-row lg:items-center lg:gap-8">
          <span className="t-meta shrink-0">Also in the federal set</span>
          {SCALE_SECONDARY.map((s) => (
            <span key={s.what} className="t-body text-fg-2">
              <span className="font-medium text-fg-1">{s.words}</span>
              <span className="text-fg-3"> · </span>
              {s.what}
            </span>
          ))}
        </div>
      </Surface>
      <Note>
        Order-of-magnitude estimates for federal data only, over several election cycles. Exact counts depend on the
        years and sources covered.
      </Note>

      <h3 className="mt-6 font-display text-[18px] leading-6 font-semibold text-fg-1">Hard Problems at This Scale</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {HARD_THINGS.map(({ icon: Icon, title, body }) => (
          <Surface key={title} className="p-5">
            <Icon size={20} strokeWidth={1.5} className="text-teal" aria-hidden="true" />
            <h3 className="t-card-title mt-4">{title}</h3>
            <p className="t-body mt-1.5 text-fg-2">{body}</p>
          </Surface>
        ))}
      </div>
    </div>
  );
}

function ScaleCell({ s, first }: { s: ScaleFigure; first: boolean }) {
  return (
    <div
      className={cx(
        "flex min-w-0 flex-col p-6",
        !first && "border-t border-line sm:border-t-0 lg:border-l",
        s.accent && "bg-[var(--orange-soft)]",
      )}
    >
      <p
        className={cx(
          "font-display text-[44px] leading-[48px] font-bold tracking-[-0.02em]",
          s.accent ? "text-orange-ink" : "text-fg-1",
        )}
      >
        {s.exponent !== undefined ? (
          <>
            {s.prefix ? <span className="mr-0.5 text-fg-3">{s.prefix}</span> : null}
            10<sup className="ml-0.5 align-[0.9em] text-[22px] leading-none">{s.exponent}</sup>
          </>
        ) : (
          s.figure
        )}
      </p>
      <DecadeMeter exponent={s.exponent} accent={s.accent} />
      <p className="t-card-title mt-4">{s.words}</p>
      <p className="t-meta mt-1">{s.what}</p>
    </div>
  );
}

/** Nine segments, one per power of ten. Filled up to the exponent. The 50-state cell shows all, outlined. */
function DecadeMeter({ exponent, accent }: { exponent?: number; accent?: boolean }) {
  const multiplier = exponent === undefined;
  return (
    <div className="mt-4 flex h-1.5 gap-[3px]" aria-hidden="true">
      {Array.from({ length: DECADES }, (_, i) => {
        const filled = !multiplier && i < (exponent ?? 0);
        return (
          <span
            key={i}
            className={cx(
              "flex-1 rounded-[1px]",
              multiplier
                ? "border border-dashed border-teal"
                : filled
                  ? accent
                    ? "bg-orange"
                    : "bg-teal"
                  : "bg-surface-3",
            )}
          />
        );
      })}
    </div>
  );
}

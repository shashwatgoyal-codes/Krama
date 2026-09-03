"use client";

import { useRef, useState } from "react";
import { TINT_PRESETS, tintPreset } from "@/lib/notes";
import { normaliseHex, isHexTint } from "@/lib/tint-colour";

/**
 * The five sticky tints, each swappable for a preset.
 *
 * "Click one to recolour it", as the design says — clicking a swatch
 * opens the list of presets for that slot. Presets rather than a free
 * colour picker because a note's text is always dark: any hue a user
 * could invent might be one their own writing disappears into, and
 * refusing to render that is worse than not offering it.
 *
 * The same preset can sit in two slots. That is allowed on purpose —
 * it is their board, and stopping them is a rule to explain for no gain.
 */
export default function TintPicker({ chosen }: { chosen: string[] }) {
  const [tints, setTints] = useState(chosen);
  const [open, setOpen] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);

  function pick(slot: number, value: string) {
    setTints((current) => current.map((c, i) => (i === slot ? value : c)));
    setOpen(null);

    // Changing a hidden input's value from React fires no event, so the
    // enclosing form never learns anything changed and its Save button
    // never appears. Say so explicitly.
    root.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }

  return (
    <div ref={root} className="relative">
      <div className="flex gap-2">
        {tints.map((value, slot) => {
          const preset = tintPreset(value);
          return (
            <span key={slot} className="relative">
              {/* The posted value; the button beside it is the control. */}
              <input type="hidden" name="noteTints" value={value} />
              <button
                type="button"
                onClick={() => setOpen(open === slot ? null : slot)}
                aria-label={`Sticky colour ${slot + 1}: ${preset.label}`}
                aria-expanded={open === slot}
                className={
                  "block size-[22px] cursor-pointer rounded-[5px] border transition-transform hover:scale-110 " +
                  (open === slot
                    ? "ring-2 ring-ink ring-offset-1 ring-offset-surf"
                    : "")
                }
                style={{
                  backgroundColor: `var(--n${slot + 1})`,
                  borderColor: `var(--n${slot + 1}b)`,
                }}
              />

              {open === slot && (
                <div className="glass absolute right-0 top-[30px] z-20 w-[152px] rounded-[10px] p-2">
                  <div className="grid grid-cols-4 gap-1.5">
                    {TINT_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        title={p.label}
                        aria-label={p.label}
                        onClick={() => pick(slot, p.value)}
                        className={
                          "size-[26px] cursor-pointer rounded-[5px] border transition-transform hover:scale-110 " +
                          (p.value === value ? "ring-2 ring-ink" : "")
                        }
                        style={{
                          backgroundColor: p.light[0],
                          borderColor: p.light[1],
                        }}
                      />
                    ))}
                  </div>

                  {/* Your own colour.
                      Pick the paper you want in daylight; the edge and
                      both night-time values are derived from it. Asking
                      for four would be asking somebody to do colour
                      theory to choose a yellow. */}
                  <div className="mt-2 border-t border-ln pt-2">
                    <label className="label-xs mb-1 block text-mut">
                      Or your own
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        aria-label="Pick a colour"
                        value={normaliseHex(value) ?? preset.light[0]}
                        onChange={(e) => pick(slot, e.target.value)}
                        className="size-[26px] flex-none cursor-pointer rounded-[5px] border border-ln2 bg-surf p-0"
                      />
                      <input
                        type="text"
                        spellCheck={false}
                        aria-label="Colour code"
                        placeholder="#FDF0DC"
                        defaultValue={isHexTint(value) ? value : ""}
                        onChange={(e) => {
                          // Only once it is a real colour — typing "#F"
                          // should not repaint the note grey.
                          const hex = normaliseHex(e.target.value);
                          if (hex) pick(slot, hex);
                        }}
                        className="w-full min-w-0 rounded border border-ln2 bg-surf px-1.5 py-1 font-mono text-[10.5px] uppercase focus:border-acc focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

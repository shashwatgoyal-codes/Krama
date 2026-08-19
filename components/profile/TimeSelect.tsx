import { inputClass } from "./Row";

/**
 * A reminder time, in half hours.
 *
 * A plain select rather than <input type="time">: the native control
 * renders as "--:-- --" with a clock icon, sizes itself differently in
 * every browser, and offers minute precision nobody wants for a daily
 * nudge. Half-hour steps are the only answers anyone gives.
 *
 * "Off" is the empty value, so clearing a reminder is a choice in the
 * list rather than knowing to select the text and delete it.
 */
const TIMES = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 ? "30" : "00";
  return `${String(h).padStart(2, "0")}:${m}`;
});

export default function TimeSelect({
  name,
  value,
  id,
}: {
  name: string;
  value: string | null;
  id?: string;
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={value ?? ""}
      className={`w-[120px] ${inputClass}`}
    >
      <option value="">Off</option>
      {TIMES.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

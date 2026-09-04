import { clockLabel, type TimeFormat } from "@/lib/time";
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
/**
 * The stored value stays 24-hour — it is what the server parses and what
 * every other reminder is compared against. Only the label follows the
 * reader's clock, so choosing a time and reading it back agree.
 */
const TIMES = Array.from({ length: 48 }, (_, i) => {
  const minutes = i * 30;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60 ? "30" : "00";
  return { value: `${String(h).padStart(2, "0")}:${m}`, minutes };
});

export default function TimeSelect({
  name,
  value,
  id,
  timeFormat = "24",
}: {
  name: string;
  value: string | null;
  id?: string;
  timeFormat?: TimeFormat;
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={value ?? ""}
      className={`w-[132px] ${inputClass}`}
    >
      <option value="">Off</option>
      {TIMES.map((t) => (
        <option key={t.value} value={t.value}>
          {clockLabel(t.minutes, timeFormat)}
        </option>
      ))}
    </select>
  );
}

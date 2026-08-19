/**
 * The joined pill of choices the design uses for every either/or.
 *
 * Built from radio inputs rather than buttons and state: it renders on
 * the server, works before hydration, and arrow keys move between the
 * options for free because that is what a radio group already does.
 */
export default function Segmented({
  name,
  value,
  options,
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div
      role="radiogroup"
      className="inline-flex overflow-hidden rounded-[7px] border border-ln2"
    >
      {options.map((option, index) => (
        <label
          key={option.value}
          className={
            "cursor-pointer px-2.5 py-[5px] text-[11.5px] font-semibold transition-colors " +
            (index > 0 ? "border-l border-ln2 " : "") +
            "text-mut hover:text-acc has-[:checked]:bg-acc has-[:checked]:text-on-acc"
          }
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            defaultChecked={option.value === value}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

import Field from "./Field";

/**
 * The code input.
 *
 * inputMode="numeric" rather than type="number": a number input brings
 * spinner arrows and will happily accept "1e5", neither of which belongs
 * on a six-digit code. autoComplete="one-time-code" still lets a phone
 * offer the code from an SMS if one is ever added.
 *
 * No autofocus — the code is in an image the person has to go and look
 * at, so grabbing focus before they've read it helps nobody.
 */
export default function CodeField({
  label = "Code from the image",
}: {
  label?: string;
}) {
  return (
    <Field
      label={label}
      name="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      required
      maxLength={7}
      spellCheck={false}
      placeholder="000000"
      className="text-center font-mono text-[19px] tracking-[0.4em]"
      hint="Six digits, shown as a picture in the email. It expires in 10 minutes."
    />
  );
}

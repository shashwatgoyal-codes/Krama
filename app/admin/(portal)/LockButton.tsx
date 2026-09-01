import { lockPortal } from "./actions";

/**
 * Ending the admin window without ending the sign-in.
 *
 * Worth having as its own control: "I'm done in here" and "I'm leaving
 * this computer" are different intentions, and the only way to express
 * the first one otherwise is to wait thirty minutes.
 */
export default function LockButton() {
  return (
    <form action={lockPortal}>
      <button
        type="submit"
        className="rounded-md border border-ln2 px-2 py-1 text-[11.5px] font-medium transition-colors hover:bg-surf2 hover:text-ink"
      >
        Lock
      </button>
    </form>
  );
}

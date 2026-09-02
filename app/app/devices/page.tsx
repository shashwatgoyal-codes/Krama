import type { Metadata } from "next";
import { requireUserOrThrow } from "@/lib/auth/guard";
import { currentSessionId } from "@/lib/auth/session";
import { listDevices } from "@/lib/repositories/sessions";
import { pageTitle } from "@/lib/env";
import DeviceRow from "./DeviceRow";
import { signOutDevice, signOutOthers } from "./actions";

export const metadata: Metadata = {
  title: pageTitle("Devices"),
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DevicesPage() {
  const user = await requireUserOrThrow();
  const current = await currentSessionId();
  const devices = await listDevices(user.id, current);
  const others = devices.filter((d) => !d.current).length;

  return (
    <div className="mx-auto max-w-[640px] px-4 py-8">
      <h1 className="font-display text-[17px] font-semibold">Devices</h1>
      <p className="mt-2 max-w-[54ch] text-[12.5px] leading-relaxed text-mut">
        Everywhere you are signed in. If one of these is not you, sign it out —
        it takes effect immediately, and the rest keep working.
      </p>

      <div className="mt-5 rounded-xl border border-ln bg-surf">
        {devices.map((d) => (
          <DeviceRow key={d.id} device={d} action={signOutDevice} />
        ))}
      </div>

      {others > 0 && (
        <form action={signOutOthers} className="mt-4">
          <button
            type="submit"
            className="rounded-lg border border-ln2 px-3 py-1.5 text-[12.5px] font-semibold text-mut transition-colors hover:border-bad hover:text-bad"
          >
            Sign out the other {others === 1 ? "device" : `${others} devices`}
          </button>
          <p className="mt-1.5 text-[11px] text-fai">
            Leaves this one signed in. Use it if you have lost a phone, or just
            want to start clean.
          </p>
        </form>
      )}

      <p className="mt-6 text-[11.5px] leading-relaxed text-fai">
        No locations here. Working out where a device is means looking its
        address up with a third party and storing addresses this app does not
        keep — and it is often wrong by a few hundred kilometres, which would
        make you doubt a list whose whole job is to be trusted. When you signed
        in and whether you have used it since answer &ldquo;is this me?&rdquo;
        without any of that.
      </p>
    </div>
  );
}

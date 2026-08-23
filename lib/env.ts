/**
 * Which environment this deployment is.
 *
 * Worth being explicit about: with four environments and one database
 * between them for now, the easiest mistake to make is testing against
 * data you thought was disposable. The badge in the top bar exists so
 * that mistake is visible rather than discovered later.
 */

export const ENVIRONMENTS = ["dev", "qa", "stage", "prod"] as const;
export type AppEnv = (typeof ENVIRONMENTS)[number];

export function appEnv(): AppEnv {
  const raw = process.env.APP_ENV;
  return (ENVIRONMENTS as readonly string[]).includes(raw ?? "")
    ? (raw as AppEnv)
    : "dev";
}

/** Production is unlabelled — a badge there would just be furniture. */
export function shouldShowEnvBadge(env: AppEnv): boolean {
  return env !== "prod";
}

export const ENV_LABEL: Record<AppEnv, string> = {
  dev: "Dev",
  qa: "QA",
  stage: "Staging",
  prod: "Production",
};

/**
 * What the app calls itself.
 *
 * The same word everywhere. The name is the product, not the server it
 * happens to be running on — a suffix in the tab told you something the
 * badge beside it already says, and made three of the four environments
 * look like a different, lesser app.
 *
 * Which environment you are in is still visible: ENV_LABEL renders as a
 * coloured badge next to the name on everything but production.
 */
export const ENV_NAME: Record<AppEnv, string> = {
  dev: "Krama",
  qa: "Krama",
  stage: "Krama",
  prod: "Krama",
};

export function appName(env: AppEnv = appEnv()): string {
  return ENV_NAME[env];
}

/** "Tasks · Krama" — one title builder, so they cannot drift. */
export function pageTitle(page: string, env: AppEnv = appEnv()): string {
  return `${page} · ${appName(env)}`;
}

export const ENV_STYLE: Record<AppEnv, string> = {
  dev: "border-ok text-ok bg-ok-soft",
  qa: "border-acc text-acc bg-acc-soft",
  stage: "border-warn text-warn bg-warn-soft",
  prod: "border-bad text-bad bg-bad-soft",
};

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
 * What the app calls itself in each environment.
 *
 * Production is simply Krama. Everything else carries a suffix, so a
 * screenshot, a bookmark or a browser tab says which one you are in
 * without you having to check the address bar — the badge is only
 * visible while you are looking at the page.
 *
 * The lower-case form matches the hostnames these deploy to
 * (krama.stage, krama.qa), so the name in the tab and the name in the
 * URL are the same word.
 */
export const ENV_NAME: Record<AppEnv, string> = {
  dev: "krama.dev",
  qa: "krama.qa",
  stage: "krama.stage",
  prod: "Krama",
};

/** The product name for this deployment, for titles and the top bar. */
export function appName(env: AppEnv = appEnv()): string {
  return ENV_NAME[env];
}

/** "Tasks · krama.stage" — one title builder, so they cannot drift. */
export function pageTitle(page: string, env: AppEnv = appEnv()): string {
  return `${page} · ${appName(env)}`;
}

export const ENV_STYLE: Record<AppEnv, string> = {
  dev: "border-ok text-ok bg-ok-soft",
  qa: "border-acc text-acc bg-acc-soft",
  stage: "border-warn text-warn bg-warn-soft",
  prod: "border-bad text-bad bg-bad-soft",
};

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

export const ENV_STYLE: Record<AppEnv, string> = {
  dev: "border-ok text-ok bg-ok-soft",
  qa: "border-acc text-acc bg-acc-soft",
  stage: "border-warn text-warn bg-warn-soft",
  prod: "border-bad text-bad bg-bad-soft",
};

import { describe, it, expect, afterEach } from "vitest";
import {
  appEnv,
  shouldShowEnvBadge,
  ENV_LABEL,
  ENV_STYLE,
  ENVIRONMENTS,
  appName,
  pageTitle,
  type AppEnv,
} from "@/lib/env";

const original = process.env.APP_ENV;
afterEach(() => {
  if (original === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = original;
});

describe("appEnv", () => {
  it("reads each known environment", () => {
    for (const env of ENVIRONMENTS) {
      process.env.APP_ENV = env;
      expect(appEnv()).toBe(env);
    }
  });

  it("falls back to dev when unset", () => {
    delete process.env.APP_ENV;
    expect(appEnv()).toBe("dev");
  });

  it("falls back to dev on a typo rather than trusting it", () => {
    // The dangerous failure would be a typo silently reading as prod and
    // hiding the badge. Anything unrecognised is treated as dev, which
    // is the loudest and least harmful guess.
    process.env.APP_ENV = "produciton";
    expect(appEnv()).toBe("dev");
  });

  it("is case sensitive — 'PROD' is not prod", () => {
    process.env.APP_ENV = "PROD";
    expect(appEnv()).toBe("dev");
  });
});

describe("shouldShowEnvBadge", () => {
  it("labels every environment except production", () => {
    expect(shouldShowEnvBadge("dev")).toBe(true);
    expect(shouldShowEnvBadge("qa")).toBe(true);
    expect(shouldShowEnvBadge("stage")).toBe(true);
    expect(shouldShowEnvBadge("prod")).toBe(false);
  });
});

describe("badge presentation", () => {
  it("every environment has a label and a style", () => {
    for (const env of ENVIRONMENTS) {
      expect(ENV_LABEL[env]).toBeTruthy();
      expect(ENV_STYLE[env]).toBeTruthy();
    }
  });

  it("gives each environment a visually distinct style", () => {
    const styles = ENVIRONMENTS.map((e) => ENV_STYLE[e]);
    expect(new Set(styles).size).toBe(styles.length);
  });
});

describe("what the app calls itself per environment", () => {
  const original = process.env.APP_ENV;
  afterEach(() => {
    if (original === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = original;
  });

  it("is plain Krama in production", () => {
    expect(appName("prod")).toBe("Krama");
  });

  const suffixed: [AppEnv, string][] = [
    ["dev", "krama.dev"],
    ["qa", "krama.qa"],
    ["stage", "krama.stage"],
  ];

  for (const [env, expected] of suffixed) {
    it(`names ${env} ${expected}`, () => {
      expect(appName(env)).toBe(expected);
    });
  }

  it("gives every environment a distinct name", () => {
    const names = ENVIRONMENTS.map((e) => appName(e));
    expect(new Set(names).size).toBe(ENVIRONMENTS.length);
  });

  it("matches the hostname it deploys to, so tab and URL agree", () => {
    for (const env of ENVIRONMENTS) {
      if (env === "prod") continue;
      expect(appName(env)).toBe(`krama.${env}`);
    }
  });

  it("builds a page title against the environment", () => {
    expect(pageTitle("Tasks", "prod")).toBe("Tasks · Krama");
    expect(pageTitle("Tasks", "stage")).toBe("Tasks · krama.stage");
  });

  it("reads the environment from APP_ENV when none is given", () => {
    process.env.APP_ENV = "stage";
    expect(appName()).toBe("krama.stage");
    process.env.APP_ENV = "prod";
    expect(appName()).toBe("Krama");
  });

  it("falls back to dev's name for an unrecognised APP_ENV", () => {
    process.env.APP_ENV = "nonsense";
    expect(appName()).toBe("krama.dev");
  });
});

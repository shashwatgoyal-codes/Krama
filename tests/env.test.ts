import { describe, it, expect, afterEach } from "vitest";
import {
  appEnv,
  shouldShowEnvBadge,
  ENV_LABEL,
  ENV_STYLE,
  ENVIRONMENTS,
  appName,
  pageTitle,
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

  it("is plain Krama everywhere else too", () => {
    // The suffixes are gone deliberately. A tab reading "krama.qa" said
    // nothing the badge beside it didn't already say, and made three of
    // the four environments look like a different product.
    for (const env of ENVIRONMENTS) {
      expect(appName(env)).toBe("Krama");
    }
  });

  it("never leaks an environment suffix into the name", () => {
    for (const env of ENVIRONMENTS) {
      expect(appName(env)).not.toContain(".");
      expect(appName(env)).toBe("Krama");
    }
  });

  it("still tells you which environment you are in, via the badge", () => {
    // The name no longer carries it, so this is now the only signal —
    // which makes it worth asserting rather than assuming.
    for (const env of ENVIRONMENTS) {
      if (env === "prod") continue;
      expect(ENV_LABEL[env].length).toBeGreaterThan(0);
      expect(shouldShowEnvBadge(env)).toBe(true);
    }
    expect(shouldShowEnvBadge("prod")).toBe(false);
  });

  it("builds a page title that is the same in every environment", () => {
    for (const env of ENVIRONMENTS) {
      expect(pageTitle("Tasks", env)).toBe("Tasks · Krama");
    }
  });

  it("reads the environment from APP_ENV when none is given", () => {
    process.env.APP_ENV = "stage";
    expect(appName()).toBe("Krama");
    process.env.APP_ENV = "prod";
    expect(appName()).toBe("Krama");
  });

  it("falls back to dev's name for an unrecognised APP_ENV", () => {
    process.env.APP_ENV = "nonsense";
    expect(appName()).toBe("Krama");
    expect(appEnv()).toBe("dev");
  });
});

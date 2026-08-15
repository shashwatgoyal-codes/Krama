import { describe, it, expect, afterEach } from "vitest";
import {
  appEnv,
  shouldShowEnvBadge,
  ENV_LABEL,
  ENV_STYLE,
  ENVIRONMENTS,
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

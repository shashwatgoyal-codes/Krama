import { describe, it, expect } from "vitest";
import {
  normaliseTagName,
  tagKey,
  sameTag,
  parseTagInput,
  isValidTagName,
  mergeTags,
  removeTag,
  sortTags,
  isTaggable,
  TAG_MAX_LENGTH,
  TAGGABLE,
} from "@/lib/tags";

/**
 * The tag vocabulary.
 *
 * All of this exists to stop one idea becoming three tags. The cases
 * that matter are the ones where a person types the same thing slightly
 * differently: capitals, stray spaces, a trailing comma, the same word
 * twice in one entry.
 */

describe("normaliseTagName", () => {
  const cases: [string, string][] = [
    ["learning", "learning"],
    ["  learning  ", "learning"],
    ["deep  work", "deep work"],
    ["deep\twork", "deep work"],
    ["deep\nwork", "deep work"],
    ["deep   \t  work", "deep work"],
    ["Learning", "Learning"],
    ["", ""],
    ["   ", ""],
    ["a", "a"],
    ["with-hyphen", "with-hyphen"],
    ["with_underscore", "with_underscore"],
    ["émigré", "émigré"],
    ["日本語", "日本語"],
    ["1", "1"],
    ["a b c d", "a b c d"],
  ];

  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} → ${JSON.stringify(expected)}`, () => {
      expect(normaliseTagName(input)).toBe(expected);
    });
  }

  it("truncates at the maximum length", () => {
    expect(normaliseTagName("x".repeat(100))).toHaveLength(TAG_MAX_LENGTH);
  });

  it("preserves the case it was given", () => {
    expect(normaliseTagName("MiXeD")).toBe("MiXeD");
  });
});

describe("tagKey", () => {
  it("lowercases", () => {
    expect(tagKey("Learning")).toBe("learning");
  });

  it("collapses the same variations normalise does", () => {
    expect(tagKey("  DEEP   WORK  ")).toBe("deep work");
  });

  const equivalent = [
    ["learning", "Learning"],
    ["learning", "LEARNING"],
    ["learning", "  learning  "],
    ["deep work", "deep  work"],
    ["deep work", "DEEP WORK"],
    ["deep work", " Deep\tWork "],
  ];

  for (const [a, b] of equivalent) {
    it(`treats ${JSON.stringify(a)} and ${JSON.stringify(b)} as one tag`, () => {
      expect(tagKey(a)).toBe(tagKey(b));
      expect(sameTag(a, b)).toBe(true);
    });
  }

  const distinct = [
    ["learning", "learn"],
    ["deep work", "deepwork"],
    ["work", "works"],
    ["a", "b"],
  ];

  for (const [a, b] of distinct) {
    it(`keeps ${JSON.stringify(a)} and ${JSON.stringify(b)} apart`, () => {
      expect(sameTag(a, b)).toBe(false);
    });
  }
});

describe("parseTagInput", () => {
  const cases: [string, string[]][] = [
    ["one", ["one"]],
    ["one, two", ["one", "two"]],
    ["one,two", ["one", "two"]],
    ["one ,  two ", ["one", "two"]],
    ["one, two, three", ["one", "two", "three"]],
    ["", []],
    ["   ", []],
    [",", []],
    [",,,", []],
    ["one,,two", ["one", "two"]],
    ["one,", ["one"]],
    [",one", ["one"]],
    ["deep work, learning", ["deep work", "learning"]],
    ["  deep   work  ", ["deep work"]],
  ];

  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} → ${JSON.stringify(expected)}`, () => {
      expect(parseTagInput(input)).toEqual(expected);
    });
  }

  it("collapses duplicates within one entry", () => {
    expect(parseTagInput("one, one")).toEqual(["one"]);
  });

  it("collapses case-different duplicates within one entry", () => {
    expect(parseTagInput("Learning, learning, LEARNING")).toEqual(["Learning"]);
  });

  it("keeps the first spelling when duplicates collapse", () => {
    expect(parseTagInput("LEARNING, learning")).toEqual(["LEARNING"]);
  });

  it("truncates each name independently", () => {
    const out = parseTagInput(`${"a".repeat(80)}, ${"b".repeat(80)}`);
    expect(out).toHaveLength(2);
    expect(out[0]).toHaveLength(TAG_MAX_LENGTH);
    expect(out[1]).toHaveLength(TAG_MAX_LENGTH);
  });
});

describe("isValidTagName", () => {
  const valid = ["a", "learning", "deep work", "x".repeat(TAG_MAX_LENGTH), "1"];
  for (const name of valid) {
    it(`accepts ${JSON.stringify(name.slice(0, 20))}`, () => {
      expect(isValidTagName(name)).toBe(true);
    });
  }

  const invalid = ["", " ", "   ", "\t", "\n"];
  for (const name of invalid) {
    it(`rejects ${JSON.stringify(name)}`, () => {
      expect(isValidTagName(name)).toBe(false);
    });
  }

  it("accepts an over-long name, because it is truncated rather than refused", () => {
    expect(isValidTagName("x".repeat(200))).toBe(true);
  });
});

describe("mergeTags", () => {
  it("adds something new", () => {
    expect(mergeTags(["a"], ["b"])).toEqual(["a", "b"]);
  });

  it("does not add a duplicate", () => {
    expect(mergeTags(["a"], ["a"])).toEqual(["a"]);
  });

  it("does not add a case-different duplicate", () => {
    expect(mergeTags(["Learning"], ["learning"])).toEqual(["Learning"]);
  });

  it("keeps the existing spelling on a collision", () => {
    expect(mergeTags(["Learning"], ["LEARNING"])).toEqual(["Learning"]);
  });

  it("preserves order, so the list does not reshuffle while editing", () => {
    expect(mergeTags(["b", "a"], ["c"])).toEqual(["b", "a", "c"]);
  });

  it("adds several at once", () => {
    expect(mergeTags(["a"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("de-duplicates within the additions themselves", () => {
    expect(mergeTags([], ["a", "A", "a"])).toEqual(["a"]);
  });

  it("handles empty inputs both ways", () => {
    expect(mergeTags([], [])).toEqual([]);
    expect(mergeTags(["a"], [])).toEqual(["a"]);
    expect(mergeTags([], ["a"])).toEqual(["a"]);
  });

  it("ignores blank additions", () => {
    expect(mergeTags(["a"], ["", "   "])).toEqual(["a"]);
  });

  it("does not mutate its input", () => {
    const original = ["a"];
    mergeTags(original, ["b"]);
    expect(original).toEqual(["a"]);
  });
});

describe("removeTag", () => {
  it("removes an exact match", () => {
    expect(removeTag(["a", "b"], "a")).toEqual(["b"]);
  });

  it("removes a case-different match", () => {
    expect(removeTag(["Learning"], "learning")).toEqual([]);
  });

  it("removes a spacing-different match", () => {
    expect(removeTag(["deep work"], "deep  work")).toEqual([]);
  });

  it("leaves the list alone when nothing matches", () => {
    expect(removeTag(["a"], "b")).toEqual(["a"]);
  });

  it("handles an empty list", () => {
    expect(removeTag([], "a")).toEqual([]);
  });

  it("does not mutate its input", () => {
    const original = ["a", "b"];
    removeTag(original, "a");
    expect(original).toEqual(["a", "b"]);
  });
});

describe("sortTags", () => {
  it("sorts alphabetically, ignoring case", () => {
    const out = sortTags([{ name: "beta" }, { name: "Alpha" }]);
    expect(out.map((t) => t.name)).toEqual(["Alpha", "beta"]);
  });

  it("does not mutate its input", () => {
    const original = [{ name: "b" }, { name: "a" }];
    sortTags(original);
    expect(original.map((t) => t.name)).toEqual(["b", "a"]);
  });

  it("handles an empty list", () => {
    expect(sortTags([])).toEqual([]);
  });

  it("keeps extra fields intact", () => {
    const out = sortTags([{ name: "a", id: "1", colour: "mut" }]);
    expect(out[0]).toMatchObject({ id: "1", colour: "mut" });
  });
});

describe("isTaggable", () => {
  for (const kind of TAGGABLE) {
    it(`accepts ${kind}`, () => {
      expect(isTaggable(kind)).toBe(true);
    });
  }

  for (const kind of ["tasks", "Task", "profile", "", "user"]) {
    it(`rejects ${JSON.stringify(kind)}`, () => {
      expect(isTaggable(kind)).toBe(false);
    });
  }
});

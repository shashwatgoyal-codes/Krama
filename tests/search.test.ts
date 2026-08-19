import { describe, it, expect } from "vitest";
import {
  parseQuery,
  kindsToSearch,
  textMatches,
  tagsMatch,
  scoreMatch,
  excerpt,
  QUERY_MAX_LENGTH,
  SEARCHABLE,
} from "@/lib/search";

/**
 * The search grammar, exhaustively.
 *
 * Search is the one feature where a person types a sentence and expects
 * a machine to guess right, so the interesting cases are the malformed
 * ones: a lone quote, a bare minus, "tag:" with nothing after it. None
 * of those should throw, and none should silently swallow the rest of
 * the query.
 */

describe("parseQuery — plain words", () => {
  const cases: [string, string[]][] = [
    ["deep work", ["deep", "work"]],
    ["  deep   work  ", ["deep", "work"]],
    ["DEEP", ["deep"]],
    ["MiXeD CaSe", ["mixed", "case"]],
    ["one", ["one"]],
    ["one two three four five", ["one", "two", "three", "four", "five"]],
    ["hyphen-word", ["hyphen-word"]],
    ["number 42", ["number", "42"]],
    ["émigré", ["émigré"]],
    ["日本語", ["日本語"]],
    ["a", ["a"]],
    ["tag", ["tag"]],
    ["is", ["is"]],
    ["tags:x", ["tags:x"]],
    ["istask", ["istask"]],
  ];

  for (const [input, expected] of cases) {
    it(`splits ${JSON.stringify(input)}`, () => {
      expect(parseQuery(input).terms).toEqual(expected);
    });
  }
});

describe("parseQuery — empty and whitespace", () => {
  for (const input of ["", " ", "   ", "\t", "\n", "  \t \n "]) {
    it(`treats ${JSON.stringify(input)} as empty`, () => {
      const q = parseQuery(input);
      expect(q.empty).toBe(true);
      expect(q.terms).toEqual([]);
    });
  }

  it("treats a null-ish input as empty rather than throwing", () => {
    expect(parseQuery(undefined as unknown as string).empty).toBe(true);
    expect(parseQuery(null as unknown as string).empty).toBe(true);
  });
});

describe("parseQuery — tag:", () => {
  const cases: [string, string[]][] = [
    ["tag:learning", ["learning"]],
    ["tag:Learning", ["learning"]],
    ["TAG:learning", ["learning"]],
    ["Tag:LEARNING", ["learning"]],
    ["tag:learning tag:work", ["learning", "work"]],
    ["tag:a tag:b tag:c", ["a", "b", "c"]],
    ["before tag:mid after", ["mid"]],
    ["tag:with-hyphen", ["with-hyphen"]],
    ["tag:", []],
    ["tag:   ", []],
  ];

  for (const [input, expected] of cases) {
    it(`reads ${JSON.stringify(input)}`, () => {
      expect(parseQuery(input).tags).toEqual(expected);
    });
  }

  it("keeps the surrounding words as terms", () => {
    const q = parseQuery("before tag:mid after");
    expect(q.terms).toEqual(["before", "after"]);
  });

  it("a bare tag: contributes nothing and leaves the query empty", () => {
    expect(parseQuery("tag:").empty).toBe(true);
  });
});

describe("parseQuery — is:", () => {
  const cases: [string, string[]][] = [
    ["is:task", ["task"]],
    ["is:tasks", ["task"]],
    ["is:note", ["note"]],
    ["is:notes", ["note"]],
    ["is:event", ["event"]],
    ["is:events", ["event"]],
    ["is:link", ["link"]],
    ["is:links", ["link"]],
    ["IS:TASK", ["task"]],
    ["is:task is:note", ["task", "note"]],
    ["is:task is:task", ["task"]],
    ["is:nonsense", []],
    ["is:", []],
  ];

  for (const [input, expected] of cases) {
    it(`reads ${JSON.stringify(input)}`, () => {
      expect(parseQuery(input).kinds).toEqual(expected);
    });
  }

  it("is: on its own is a real search, not an empty one", () => {
    expect(parseQuery("is:note").empty).toBe(false);
  });

  it("an unrecognised kind leaves the query empty rather than erroring", () => {
    expect(parseQuery("is:nonsense").empty).toBe(true);
  });
});

describe("parseQuery — phrases", () => {
  it("pulls a quoted phrase out whole", () => {
    expect(parseQuery('"deep work"').phrases).toEqual(["deep work"]);
  });

  it("lowercases phrases", () => {
    expect(parseQuery('"Deep Work"').phrases).toEqual(["deep work"]);
  });

  it("keeps words outside the quotes as terms", () => {
    const q = parseQuery('before "in quotes" after');
    expect(q.phrases).toEqual(["in quotes"]);
    expect(q.terms).toEqual(["before", "after"]);
  });

  it("reads several phrases", () => {
    expect(parseQuery('"one two" "three four"').phrases).toEqual([
      "one two",
      "three four",
    ]);
  });

  it("drops an empty phrase", () => {
    expect(parseQuery('""').phrases).toEqual([]);
    expect(parseQuery('""').empty).toBe(true);
  });

  it("drops a whitespace-only phrase", () => {
    expect(parseQuery('"   "').phrases).toEqual([]);
  });

  it("an unclosed quote does not swallow the query", () => {
    const q = parseQuery('"unclosed phrase');
    expect(q.phrases).toEqual([]);
    expect(q.terms).toContain('"unclosed');
  });

  it("a phrase protects tag: from being read as an operator", () => {
    const q = parseQuery('"tag:notreally"');
    expect(q.phrases).toEqual(["tag:notreally"]);
    expect(q.tags).toEqual([]);
  });

  it("a phrase may contain a minus without excluding anything", () => {
    const q = parseQuery('"-notanexclusion"');
    expect(q.phrases).toEqual(["-notanexclusion"]);
    expect(q.excluded).toEqual([]);
  });
});

describe("parseQuery — exclusions", () => {
  const cases: [string, string[]][] = [
    ["-draft", ["draft"]],
    ["-DRAFT", ["draft"]],
    ["-one -two", ["one", "two"]],
    ["keep -drop", ["drop"]],
    ["-", []],
    ["--double", ["-double"]],
  ];

  for (const [input, expected] of cases) {
    it(`reads ${JSON.stringify(input)}`, () => {
      expect(parseQuery(input).excluded).toEqual(expected);
    });
  }

  it("a bare minus is treated as a word, since it is someone mid-typing", () => {
    const q = parseQuery("-");
    expect(q.excluded).toEqual([]);
    expect(q.terms).toEqual(["-"]);
  });

  it("keeps the positive words alongside", () => {
    expect(parseQuery("keep -drop").terms).toEqual(["keep"]);
  });
});

describe("parseQuery — combinations", () => {
  it("reads every operator at once", () => {
    const q = parseQuery('deep "exact phrase" tag:work is:note -draft');
    expect(q.terms).toEqual(["deep"]);
    expect(q.phrases).toEqual(["exact phrase"]);
    expect(q.tags).toEqual(["work"]);
    expect(q.kinds).toEqual(["note"]);
    expect(q.excluded).toEqual(["draft"]);
    expect(q.empty).toBe(false);
  });

  it("does not care about operator order", () => {
    const a = parseQuery("tag:work is:note deep");
    const b = parseQuery("deep is:note tag:work");
    expect(a.terms).toEqual(b.terms);
    expect(a.tags).toEqual(b.tags);
    expect(a.kinds).toEqual(b.kinds);
  });

  it("truncates absurdly long input rather than parsing all of it", () => {
    const q = parseQuery("x".repeat(QUERY_MAX_LENGTH * 3));
    expect(q.terms[0]!.length).toBeLessThanOrEqual(QUERY_MAX_LENGTH);
  });
});

describe("kindsToSearch", () => {
  it("searches everything when no kind is named", () => {
    expect(kindsToSearch(parseQuery("anything"))).toEqual([...SEARCHABLE]);
  });

  for (const kind of SEARCHABLE) {
    it(`searches only ${kind} when asked for it`, () => {
      expect(kindsToSearch(parseQuery(`is:${kind}`))).toEqual([kind]);
    });
  }

  it("searches two kinds when two are named", () => {
    expect(kindsToSearch(parseQuery("is:task is:link"))).toEqual([
      "task",
      "link",
    ]);
  });
});

describe("textMatches", () => {
  it("matches a single term anywhere", () => {
    expect(textMatches("a deep thought", parseQuery("deep"))).toBe(true);
  });

  it("matches a partial word, because people half-remember", () => {
    expect(textMatches("meeting notes", parseQuery("meet"))).toBe(true);
  });

  it("is case-insensitive both ways", () => {
    expect(textMatches("DEEP WORK", parseQuery("deep"))).toBe(true);
    expect(textMatches("deep work", parseQuery("DEEP"))).toBe(true);
  });

  it("requires every term, not just one", () => {
    expect(textMatches("deep work", parseQuery("deep work"))).toBe(true);
    expect(textMatches("deep thought", parseQuery("deep work"))).toBe(false);
  });

  it("requires a phrase intact", () => {
    expect(textMatches("a deep work session", parseQuery('"deep work"'))).toBe(
      true,
    );
    expect(textMatches("deep and also work", parseQuery('"deep work"'))).toBe(
      false,
    );
  });

  it("rejects anything holding an excluded word", () => {
    expect(textMatches("deep work draft", parseQuery("deep -draft"))).toBe(
      false,
    );
    expect(textMatches("deep work final", parseQuery("deep -draft"))).toBe(
      true,
    );
  });

  it("an exclusion alone still filters", () => {
    expect(textMatches("has draft", parseQuery("-draft"))).toBe(false);
    expect(textMatches("clean", parseQuery("-draft"))).toBe(true);
  });

  it("matches everything when there are no word rules", () => {
    expect(textMatches("anything at all", parseQuery("tag:x"))).toBe(true);
  });

  it("handles an empty haystack", () => {
    expect(textMatches("", parseQuery("deep"))).toBe(false);
    expect(textMatches("", parseQuery("tag:x"))).toBe(true);
  });
});

describe("tagsMatch", () => {
  const tags = [{ name: "learning" }, { name: "Work" }];

  it("passes anything when no tag is asked for", () => {
    expect(tagsMatch([], parseQuery("word"))).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(tagsMatch(tags, parseQuery("tag:LEARNING"))).toBe(true);
    expect(tagsMatch(tags, parseQuery("tag:work"))).toBe(true);
  });

  it("requires every named tag, not any", () => {
    expect(tagsMatch(tags, parseQuery("tag:learning tag:work"))).toBe(true);
    expect(tagsMatch(tags, parseQuery("tag:learning tag:missing"))).toBe(false);
  });

  it("fails when the row has no tags at all", () => {
    expect(tagsMatch([], parseQuery("tag:learning"))).toBe(false);
  });
});

describe("scoreMatch", () => {
  it("ranks an exact title above a title prefix", () => {
    const q = parseQuery("deep");
    expect(scoreMatch("deep", "", q)).toBeGreaterThan(
      scoreMatch("deep work", "", q),
    );
  });

  it("ranks a title prefix above a title mention", () => {
    const q = parseQuery("deep");
    expect(scoreMatch("deep work", "", q)).toBeGreaterThan(
      scoreMatch("a deep thing", "", q),
    );
  });

  it("ranks a title mention above a body mention", () => {
    const q = parseQuery("deep");
    expect(scoreMatch("a deep thing", "", q)).toBeGreaterThan(
      scoreMatch("unrelated", "deep inside", q),
    );
  });

  it("adds up across several terms", () => {
    const q = parseQuery("deep work");
    expect(scoreMatch("deep work", "", q)).toBeGreaterThan(
      scoreMatch("deep", "", q),
    );
  });

  it("returns a flat score when there is nothing to rank on", () => {
    expect(scoreMatch("anything", "", parseQuery("tag:x"))).toBe(1);
  });

  it("scores zero when nothing matches", () => {
    expect(scoreMatch("unrelated", "nothing", parseQuery("deep"))).toBe(0);
  });
});

describe("excerpt", () => {
  it("returns short bodies whole", () => {
    expect(excerpt("short body", parseQuery("body"))).toBe("short body");
  });

  it("collapses whitespace", () => {
    expect(excerpt("a   b\n\nc", parseQuery("a"))).toBe("a b c");
  });

  it("returns an empty string for an empty body", () => {
    expect(excerpt("", parseQuery("x"))).toBe("");
  });

  it("centres on the match and marks both cuts", () => {
    const body = "x".repeat(200) + " needle " + "y".repeat(200);
    const out = excerpt(body, parseQuery("needle"));
    expect(out).toContain("needle");
    expect(out.startsWith("…")).toBe(true);
    expect(out.endsWith("…")).toBe(true);
  });

  it("truncates from the start when the term is absent", () => {
    const out = excerpt("z".repeat(300), parseQuery("absent"));
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThan(120);
  });

  it("respects a custom width", () => {
    const out = excerpt("w".repeat(300), parseQuery("absent"), 20);
    expect(out.length).toBeLessThanOrEqual(21);
  });

  it("does not start with an ellipsis when the match is at the beginning", () => {
    const out = excerpt("needle " + "y".repeat(300), parseQuery("needle"));
    expect(out.startsWith("…")).toBe(false);
  });
});

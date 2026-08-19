import { describe, it, expect } from "vitest";
import { checkUrl, isPrivateAddress } from "@/lib/links/ssrf";

/**
 * The guard on the one feature that makes the server fetch an address a
 * user chose. Everything here is an attack someone would actually try.
 */

describe("isPrivateAddress — IPv4", () => {
  it("blocks the ranges that live inside a network", () => {
    for (const ip of [
      "127.0.0.1", // loopback
      "0.0.0.0", // this network
      "10.1.2.3", // private
      "172.16.0.1", // private
      "172.31.255.254", // private, top of range
      "192.168.1.1", // private
      "169.254.169.254", // cloud metadata — the classic target
      "100.64.0.1", // carrier-grade NAT
      "224.0.0.1", // multicast
      "255.255.255.255", // broadcast
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it("allows ordinary public addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "192.167.1.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it("does not treat 172.32 as private just because 172.16 is", () => {
    expect(isPrivateAddress("172.15.0.1")).toBe(false);
    expect(isPrivateAddress("172.32.0.1")).toBe(false);
  });
});

describe("isPrivateAddress — IPv6", () => {
  it("blocks loopback, unique-local, link-local and multicast", () => {
    for (const ip of [
      "::1",
      "::",
      "fc00::1",
      "fd12:3456::1",
      "fe80::1",
      "ff02::1",
      "[::1]",
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it("sees through an IPv4 address hidden inside an IPv6 one", () => {
    // ::ffff:127.0.0.1 is loopback wearing a different hat.
    expect(isPrivateAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateAddress("::ffff:169.254.169.254")).toBe(true);
    expect(isPrivateAddress("::127.0.0.1")).toBe(true);
  });

  it("allows a public IPv6 address", () => {
    expect(isPrivateAddress("2606:4700:4700::1111")).toBe(false);
  });
});

describe("checkUrl — schemes", () => {
  it("accepts http and https", () => {
    expect(checkUrl("https://example.com/a").ok).toBe(true);
    expect(checkUrl("http://example.com").ok).toBe(true);
  });

  it("refuses schemes that read the machine rather than the web", () => {
    for (const url of [
      "file:///etc/passwd",
      "gopher://example.com",
      "data:text/html,hi",
      "ftp://example.com",
      "javascript:alert(1)",
    ]) {
      const result = checkUrl(url);
      expect(result.ok, url).toBe(false);
    }
  });

  it("assumes https for a bare host, which is what people paste", () => {
    const result = checkUrl("example.com/article");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url.protocol).toBe("https:");
  });
});

describe("checkUrl — private targets", () => {
  it("refuses names that never leave the machine", () => {
    for (const url of [
      "http://localhost:5432",
      "http://localhost",
      "http://db.local",
      "http://api.internal/secrets",
      "http://router.home.arpa",
    ]) {
      expect(checkUrl(url).ok, url).toBe(false);
    }
  });

  it("refuses literal private addresses", () => {
    for (const url of [
      "http://127.0.0.1:3000/app",
      "http://169.254.169.254/latest/meta-data/",
      "http://10.0.0.5/admin",
      "http://192.168.0.1",
      "http://[::1]:8080",
    ]) {
      expect(checkUrl(url).ok, url).toBe(false);
    }
  });

  it("is not fooled by zero-padded or hex octets", () => {
    // 0177.0.0.1 and 0x7f.0.0.1 are both 127.0.0.1 to many resolvers.
    // Rejecting the odd notation outright is safer than normalising it.
    for (const url of ["http://0177.0.0.1", "http://0x7f.0.0.1"]) {
      expect(checkUrl(url).ok, url).toBe(false);
    }
  });

  it("refuses credentials embedded in the URL", () => {
    // We would store and later replay them; and user:pass@host is a
    // well-worn way to make a link look like it points somewhere else.
    expect(checkUrl("https://user:pass@example.com").ok).toBe(false);
  });
});

describe("checkUrl — nonsense", () => {
  it("rejects input that isn't a link at all", () => {
    for (const input of ["", "   ", "not a url at all", "http://"]) {
      expect(checkUrl(input).ok, JSON.stringify(input)).toBe(false);
    }
  });

  it("keeps the path and query of a real link", () => {
    const result = checkUrl("https://example.com/posts/1?utm=x#top");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url.pathname).toBe("/posts/1");
      expect(result.url.search).toBe("?utm=x");
    }
  });
});

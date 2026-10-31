import assert from "node:assert/strict";
import test from "node:test";
import {
  isLoopbackAddress,
  isLoopbackHostname,
  normalizeRemoteAddress,
  originMatchesLoopback
} from "../src/lib/request-guards.js";

test("loopback helpers normalize IPv4-mapped addresses", () => {
  assert.equal(normalizeRemoteAddress("::ffff:127.0.0.1"), "127.0.0.1");
  assert.equal(isLoopbackAddress("::ffff:127.0.0.1"), true);
  assert.equal(isLoopbackAddress("127.0.0.1"), true);
  assert.equal(isLoopbackAddress("192.168.1.9"), false);
});

test("loopback helpers accept localhost hostnames", () => {
  assert.equal(isLoopbackHostname("localhost"), true);
  assert.equal(isLoopbackHostname("[::1]"), true);
  assert.equal(isLoopbackHostname("example.com"), false);
});

test("origin matching only trusts local loopback origins on the expected port", () => {
  assert.equal(originMatchesLoopback("http://127.0.0.1:3000", "3000"), true);
  assert.equal(originMatchesLoopback("http://localhost:3000", "3000"), true);
  assert.equal(originMatchesLoopback("http://localhost:3100", "3000"), false);
  assert.equal(originMatchesLoopback("https://evil.example", "3000"), false);
});

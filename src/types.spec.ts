import { Duration } from "./types";

it("should construct Duration correctly", () => {
  expect(Duration.fromSeconds(1).asSeconds()).toBeCloseTo(1);
  expect(Duration.fromHours(1).asSeconds()).toBeCloseTo(3600);
  expect(Duration.fromDays(1).asSeconds()).toBeCloseTo(24 * 3600);
  expect(Duration.fromMillis(1).asSeconds()).toBeCloseTo(0.001);
});

it("should convert Duration to milliseconds", () => {
  expect(Duration.fromMillis(250).asMillis()).toBeCloseTo(250);
  expect(Duration.fromSeconds(1).asMillis()).toBeCloseTo(1000);
  expect(Duration.fromHours(1).asMillis()).toBeCloseTo(3_600_000);
});

it("should convert Duration to whole milliseconds", () => {
  // Milliseconds are held as seconds, so `1_001 / 1_000 * 1_000` is not the
  // integer it started as and must not come back a millisecond short.
  for (let ms = 0; ms <= 60_000; ms++) {
    expect(Duration.fromMillis(ms).asMillis()).toBe(ms);
  }
});

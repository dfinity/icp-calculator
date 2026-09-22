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
  for (let ms = 0; ms <= 60_000; ms++) {
    expect(Duration.fromMillis(ms).asMillis()).toBe(ms);
  }
  // Whole seconds are whole milliseconds too.
  for (let s = 0; s <= 200; s++) {
    expect(Duration.fromSeconds(s).asMillis()).toBe(s * 1000);
  }
});

it("should not count part of a millisecond as one", () => {
  // The protocol charges the whole milliseconds a response took, so part of
  // one is not charged, however close to the next it is.
  expect(Duration.fromSeconds(1.0006).asMillis()).toBe(1000);
  expect(Duration.fromMillis(1000.9).asMillis()).toBe(1000);
  expect(Duration.fromMillis(0.9).asMillis()).toBe(0);
  expect(Duration.fromSeconds(1.0006).asSeconds()).toBeCloseTo(1.0006);
});

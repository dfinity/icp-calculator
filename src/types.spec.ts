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

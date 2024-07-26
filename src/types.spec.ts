import { Duration } from "./types";

it("should construct Duration correctly", () => {
  expect(Duration.fromSeconds(1).asSeconds()).toBeCloseTo(1);
  expect(Duration.fromHours(1).asSeconds()).toBeCloseTo(3600);
  expect(Duration.fromDays(1).asSeconds()).toBeCloseTo(24 * 3600);
});

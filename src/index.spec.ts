import { sum } from "./index";

it("should sum 1n + 2n to equal 3n", () => {
  expect(sum({ a: 1n, b: 2n })).toBe(3n);
});

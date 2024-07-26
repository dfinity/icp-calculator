import {
  Direction,
  Duration,
  Mode,
  type Bytes,
  type Calculator,
  type Cycles,
  type Instructions,
} from "./index";
import { toUSD } from "./usd";

const COST: Cycles = 1_000_000_000_000 as Cycles;
class ConstCalculator implements Calculator<Cycles> {
  storage(_size: Bytes, _duration: Duration): Cycles {
    return COST;
  }

  execution(_mode: Mode, _instructions: Instructions): Cycles {
    return COST;
  }

  message(_mode: Mode, _direction: Direction, _size: Bytes): Cycles {
    return COST;
  }

  httpOutcall(_request: Bytes, _response: Bytes): Cycles {
    return COST;
  }

  canisterCreation(): Cycles {
    return COST;
  }
}

it("should convert storage cost to USD", () => {
  const { cyclesPerUSD, calculatorUSD: $ } = toUSD({
    calculatorCycles: new ConstCalculator(),
    cyclesPerUSD: COST,
  });
  expect(cyclesPerUSD).toBeCloseTo(COST);
  expect($.storage(10 as Bytes, Duration.fromDays(365))).toBeCloseTo(1);
});

it("should convert execution cost to USD", () => {
  const { cyclesPerUSD, calculatorUSD: $ } = toUSD({
    calculatorCycles: new ConstCalculator(),
    cyclesPerUSD: COST,
  });
  expect(cyclesPerUSD).toBeCloseTo(COST);
  expect($.execution(Mode.Replicated, 10 as Instructions)).toBeCloseTo(1);
});

it("should convert message cost to USD", () => {
  const { cyclesPerUSD, calculatorUSD: $ } = toUSD({
    calculatorCycles: new ConstCalculator(),
    cyclesPerUSD: COST,
  });
  expect(cyclesPerUSD).toBeCloseTo(COST);
  expect(
    $.message(Mode.Replicated, Direction.UserToCanister, 10 as Bytes),
  ).toBeCloseTo(1);
});

it("should convert message cost to USD", () => {
  const { cyclesPerUSD, calculatorUSD: $ } = toUSD({
    calculatorCycles: new ConstCalculator(),
    cyclesPerUSD: COST,
  });
  expect(cyclesPerUSD).toBeCloseTo(COST);
  expect($.httpOutcall(10 as Bytes, 20 as Bytes)).toBeCloseTo(1);
});

it("should convert canister creation cost to USD", () => {
  const { cyclesPerUSD, calculatorUSD: $ } = toUSD({
    calculatorCycles: new ConstCalculator(),
    cyclesPerUSD: COST,
  });
  expect(cyclesPerUSD).toBeCloseTo(COST);
  expect($.canisterCreation()).toBeCloseTo(1);
});

import {
  Direction,
  Duration,
  Mode,
  type Bytes,
  type Calculator,
  type Cycles,
  type HttpOutcallUsage,
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

  httpOutcallV2(_usage: HttpOutcallUsage): Cycles {
    return COST;
  }

  httpOutcallV2Payment(_usage: HttpOutcallUsage): Cycles {
    return COST;
  }

  canisterCreation(): Cycles {
    return COST;
  }

  computeAllocation(_percent: number, _duration: Duration): Cycles {
    return COST;
  }

  memoryAllocation(_bytes: Bytes, _duration: Duration): Cycles {
    return COST;
  }

  signWithEcdsa(_args: Bytes, _signature: Bytes): Cycles {
    return COST;
  }

  signWithSchnorr(_args: Bytes, _signature: Bytes): Cycles {
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

it("should convert HTTP outcall cost to USD", () => {
  const { cyclesPerUSD, calculatorUSD: $ } = toUSD({
    calculatorCycles: new ConstCalculator(),
    cyclesPerUSD: COST,
  });
  const usage = { request: 10 as Bytes, response: 20 as Bytes };
  expect(cyclesPerUSD).toBeCloseTo(COST);
  expect($.httpOutcall(10 as Bytes, 20 as Bytes)).toBeCloseTo(1);
  expect($.httpOutcallV2(usage)).toBeCloseTo(1);
  expect($.httpOutcallV2Payment(usage)).toBeCloseTo(1);
});

it("should convert canister creation cost to USD", () => {
  const { cyclesPerUSD, calculatorUSD: $ } = toUSD({
    calculatorCycles: new ConstCalculator(),
    cyclesPerUSD: COST,
  });
  expect(cyclesPerUSD).toBeCloseTo(COST);
  expect($.canisterCreation()).toBeCloseTo(1);
});

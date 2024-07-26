import type {
  Bytes,
  Calculator,
  Cycles,
  Direction,
  Duration,
  Instructions,
  Mode,
  USD,
} from "./types";

/**
 * The cycles minting canister offers 1 trillion cycles for 1 XDR.
 * The rate USD/XDR as of July 2024: 1 XDR = 0.755 USD.
 * Thus, 1 USD = 755 billion cycles.
 */
const DEFAULT_CYCLES_PER_USD: Cycles = 755_000_000_000 as Cycles;

/**
 * Constructs a calculator that operates in USD based on a calculator that
 * operates in cycles and based on the exchange rate between cycles and USD.
 *
 * @param calc - the base calculator that operates in cycles.
 * @param cyclesPerUSD  - the exchange rate between cycles and USD.
 * @returns a tuple consisting of the exchange rate and the calculator.
 */
export function toUSD(
  calc: Calculator<Cycles>,
  cyclesPerUSD?: Cycles,
): [Cycles, Calculator<USD>] {
  const exchangeRate = cyclesPerUSD ?? DEFAULT_CYCLES_PER_USD;
  function asUSD(cycles: Cycles): USD {
    return (cycles / exchangeRate) as USD;
  }
  class CostCalculatorUSD implements Calculator<USD> {
    storage(size: Bytes, duration: Duration): USD {
      return asUSD(calc.storage(size, duration));
    }

    execution(mode: Mode, instructions: Instructions): USD {
      return asUSD(calc.execution(mode, instructions));
    }

    message(mode: Mode, direction: Direction, size: Bytes): USD {
      return asUSD(calc.message(mode, direction, size));
    }

    httpOutcall(request: Bytes, response: Bytes): USD {
      return asUSD(calc.httpOutcall(request, response));
    }

    canisterCreation(): USD {
      return asUSD(calc.canisterCreation());
    }
  }
  return [exchangeRate, new CostCalculatorUSD()];
}

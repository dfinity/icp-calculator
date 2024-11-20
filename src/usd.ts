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
 * The rate USD/XDR as of July 2024: 1 XDR = 1.325 USD.
 * Thus, 1 USD = 755 billion cycles.
 */
const DEFAULT_CYCLES_PER_USD: Cycles = 755_000_000_000 as Cycles;

/**
 * Constructs a calculator that operates in USD based on a calculator that
 * operates in cycles and based on the exchange rate between cycles and USD.
 *
 * @param calculatorCycles - the base calculator that operates in cycles.
 * @param cyclesPerUSD  - the exchange rate between cycles and USD.
 * @returns an object consisting of the exchange rate and the calculator.
 */
export function toUSD({
  calculatorCycles,
  cyclesPerUSD,
}: {
  calculatorCycles: Calculator<Cycles>;
  cyclesPerUSD?: Cycles;
}): { cyclesPerUSD: Cycles; calculatorUSD: Calculator<USD> } {
  const calc = calculatorCycles;
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

    computeAllocation(percent: number, duration: Duration): USD {
      return asUSD(calc.computeAllocation(percent, duration));
    }

    memoryAllocation(bytes: Bytes, duration: Duration): USD {
      return asUSD(calc.memoryAllocation(bytes, duration));
    }

    signWithEcdsa(args: Bytes, signature: Bytes): USD {
      return asUSD(calc.signWithEcdsa(args, signature));
    }

    signWithSchnorr(args: Bytes, signature: Bytes): USD {
      return asUSD(calc.signWithSchnorr(args, signature));
    }
  }
  return { cyclesPerUSD: exchangeRate, calculatorUSD: new CostCalculatorUSD() };
}

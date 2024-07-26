import { calculator } from "./calculator";
import type { Calculator, Cycles, SubnetType, USD } from "./types";
import { toUSD } from "./usd";

export * from "./types";

/**
 * Options to configure the calculators.
 */
export interface Options {
  /**
   * The type of the subnet: application or system.
   * The default is an application subnet.
   */
  subnetType?: SubnetType;

  /**
   * The number of nodes in the subnet.
   * The default is 13 nodes.
   */
  subnetSize?: number;

  /**
   * The current exchange rate of cycles / USD.
   * How many cycles one USD can buy?
   * The default is 755B cycles.
   */
  cyclesPerUSD?: Cycles;
}

/**
 * Cost calculators and some metadata that might be useful for the user.
 */

export interface Calculators {
  /**
   * The calculator that operates in cycles.
   */
  calculatorCycles: Calculator<Cycles>;

  /**
   * The calculator that operates in USD.
   */
  calculatorUSD: Calculator<USD>;

  /**
   *  The exchange rate between cycles and USD that was used to construct the
   *  USD calculator.
   */
  cyclesPerUSD: Cycles;

  /**
   * The version of the replica that the calculators correspond to.
   */
  version: string;
}

/**
 * The main export of the library. It returns cost calculators that operate in
 * cycles and USD based on the given options.
 *
 * @param options - optional options to configure the calculators.
 */
export function calculators(options?: Options): Calculators {
  const [version, calcCycles] = calculator(
    options?.subnetType,
    options?.subnetSize,
  );
  const [cyclesPerUSD, calcUSD] = toUSD(calcCycles, options?.cyclesPerUSD);
  return {
    version,
    calculatorCycles: calcCycles,
    calculatorUSD: calcUSD,
    cyclesPerUSD,
  };
}

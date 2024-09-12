/**
 * A numeric type that represents cycles.
 */
export type Cycles = number & { readonly Cycles: unique symbol };

/**
 * A numeric type that represents USD amounts.
 */
export type USD = number & { readonly USD: unique symbol };

/**
 * A numeric type that represents a number of executed instructions.
 */
export type Instructions = number & { readonly Instructions: unique symbol };

/**
 * A numeric type that represents a number bytes.
 */
export type Bytes = number & { readonly Bytes: unique symbol };

/**
 * A type that represent time duration.
 */
export class Duration {
  private readonly seconds: number;

  private constructor(seconds: number) {
    this.seconds = seconds;
  }

  asSeconds(): number {
    return this.seconds;
  }

  static fromSeconds(seconds: number): Duration {
    return new Duration(seconds);
  }

  static fromHours(hours: number): Duration {
    const SECONDS_PER_HOUR = 3600;
    return new Duration(hours * SECONDS_PER_HOUR);
  }

  static fromDays(days: number): Duration {
    const HOURS_PER_DAY = 24;
    return Duration.fromHours(days * HOURS_PER_DAY);
  }
}

/**
 * A type that represent execution mode:
 *
 * - replicated execution corresponds to update (and other) calls that are
 *   executed on all nodes and go through consensus.
 *
 * - non-replicated execution corresponds to read-only query calls that are
 *   executed on a single node and don't go through consensus.
 */
export enum Mode {
  Replicated,
  NonReplicated,
}

/**
 * The direction of sending a message:
 *
 * - user-to-canister: the message is sent by a user to a canister. These
 *   messages in replicated execution mode are also known as 'ingress' messages.
 *
 * - canister-to-canister: the message is sent from a canister to a canister.
 *   These messages are also known as cross-canister calls.
 */
export enum Direction {
  UserToCanister,
  CanisterToCanister,
}

/**
 * The type of a subnet.
 *
 * Most users will use an application subnet.
 */
export enum SubnetType {
  Application,
  System,
}

/**
 * A cost calculator that operates in the given currency.
 */
export interface Calculator<Currency> {
  /**
   * Computes the cost of storing the given number of bytes for the given
   * duration.
   *
   * @param size - the number of stored bytes
   * @param duration  - the storage duration.
   */
  storage: (size: Bytes, duration: Duration) => Currency;

  /**
   * Computes the cost of executing a single message.
   * @param mode - replicated/non-replicated (~ update/query).
   * @param instructions - the number of executed instructions.
   */
  execution: (mode: Mode, instructions: Instructions) => Currency;

  /**
   * Computes the cost of sending a message.
   *
   * @param mode - replicated/non-replicated (~ update/query).
   * @param direction - whether a message is sent by a user or a canister.
   * @param size - the size of the message in bytes (header + payload).
   */
  message: (mode: Mode, direction: Direction, size: Bytes) => Currency;

  /**
   * Computes the cost of making an HTTP outcall.
   *
   * @param request - the size of the HTTP request in bytes.
   * @param response - the size of the HTTP response in bytes.
   */
  httpOutcall: (request: Bytes, response: Bytes) => Currency;

  /**
   * Computes the cost of create one canister.
   */
  canisterCreation: () => Currency;

  /**
   * Computes the cost of reserving the given amount of compute allocation for
   * the given duration.
   * @param percent - the amount of compute allocation represented in percents
   * of a CPU core.
   * @param duration - the duration for which the compute allocation is reserved.
   */
  computeAllocation: (percent: number, duration: Duration) => Currency;

  /**
   * Computes the cost of reserving the given amount of storage for the given
   * duration.
   * @param size - the number of storage bytes.
   * @param duration  - the storage duration.
   */
  memoryAllocation: (bytes: Bytes, duration: Duration) => Currency;

  /**
   * Computes the cost calling the `sign_with_ecdsa` endpoint of the management
   * canister.
   *
   * @param args - the total size of arguments.
   * @param signature  - the size of the result signature.
   */
  signWithEcdsa: (args: Bytes, signature: Bytes) => Currency;

  /**
   * Computes the cost calling the `sign_with_schnorr` endpoint of the management
   * canister.
   *
   * @param args - the total size of arguments.
   * @param signature  - the size of the result signature.
   */
  signWithSchnorr: (args: Bytes, signature: Bytes) => Currency;
}

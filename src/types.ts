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

  /**
   * The duration as a whole number of milliseconds, which is the unit the
   * protocol counts elapsed time in. Rounded, because a duration constructed
   * from milliseconds is held in seconds and so need not come back out as the
   * exact integer it went in as.
   */
  asMillis(): number {
    const MILLIS_PER_SECOND = 1000;
    return Math.round(this.seconds * MILLIS_PER_SECOND);
  }

  static fromSeconds(seconds: number): Duration {
    return new Duration(seconds);
  }

  static fromMillis(millis: number): Duration {
    const MILLIS_PER_SECOND = 1000;
    return new Duration(millis / MILLIS_PER_SECOND);
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
 * How many nodes of the subnet perform an HTTP outcall, and how their responses
 * reach the calling canister.
 *
 * The replication of an outcall drives its cost more than any other input, and
 * only pricing version 2 prices the reduced-replication modes.
 */
export enum Replication {
  /**
   * Every node performs the outcall and the subnet agrees on a single response
   * through consensus. This is what `http_request` does by default.
   */
  FullyReplicated,

  /**
   * A single node performs the outcall and its response is delivered without
   * the subnet agreeing on it, which makes the response untrustworthy.
   * Corresponds to `http_request` with `is_replicated = false`.
   */
  NonReplicated,

  /**
   * A committee of nodes performs the outcall and several of their responses
   * are delivered, leaving the canister to reconcile them. Corresponds to
   * `flexible_http_request`.
   */
  Flexible,
}

/**
 * The resources a single HTTP outcall consumes, which is what pricing version 2
 * charges for.
 *
 * Every field except the request and response sizes is optional and defaults to
 * what the protocol assumes when the corresponding field of the request is left
 * unset.
 */
export interface HttpOutcallUsage {
  /**
   * The total serialized size of the request: URL, headers, body, and the name
   * and context of the transform function.
   */
  request: Bytes;

  /**
   * The number of bytes downloaded from the server, before the transform runs.
   */
  response: Bytes;

  /**
   * The number of bytes of response delivered to the canister, as consensus
   * carries it: the response the transform returned, Candid-encoded. Defaults
   * to `response`, which is what a call without a transform delivers.
   *
   * A node may deliver a reject rather than the response that was asked for,
   * so {@link Calculator.httpOutcallV2Payment} reserves for at least a
   * maximally large one however small a response this is.
   */
  delivered?: Bytes;

  /**
   * How long the request takes to come back. Priced per millisecond, and held
   * to 60 seconds, the longest the protocol waits. Defaults to zero.
   */
  roundtrip?: Duration;

  /**
   * The number of instructions the transform function executes, held to the
   * 5 billion instruction limit of a query call. Defaults to zero, which is
   * what a call without a transform is charged.
   */
  transformInstructions?: Instructions;

  /**
   * Which nodes perform the outcall. Defaults to
   * {@link Replication.FullyReplicated}.
   */
  replication?: Replication;

  /**
   * How many nodes perform the outcall. Only meaningful for
   * {@link Replication.Flexible}, where it defaults to the subnet size.
   */
  totalRequests?: number;

  /**
   * How many responses have to agree for the outcall to succeed. Only
   * meaningful for {@link Replication.Flexible}, where it defaults to
   * `floor(2 / 3 * totalRequests) + 1` and is held to `totalRequests`, since
   * no more responses can be required than there are nodes to produce them.
   */
  minResponses?: number;

  /**
   * How many responses are delivered to the canister. Only meaningful for
   * {@link Replication.Flexible}, where it defaults to `minResponses` and is
   * held to `totalRequests`. Zero describes a fire-and-forget call, which
   * delivers nothing.
   */
  deliveredResponses?: number;
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
   * Computes the cost of making an HTTP outcall priced by pricing version 1,
   * which charges for the bytes a call reserves rather than the ones it uses.
   *
   * @param request - the size of the HTTP request in bytes.
   * @param response - the value of `max_response_bytes`, or 2,000,000 if the
   * call leaves it unset.
   *
   * @deprecated Version 1 is still the default, but it is deprecated and will
   * be removed once version 2 becomes the default. Use
   * {@link Calculator.httpOutcallV2} instead.
   */
  httpOutcall: (request: Bytes, response: Bytes) => Currency;

  /**
   * Computes the cost of making an HTTP outcall priced by pricing version 2,
   * which charges for the resources a call actually consumes. This is what the
   * call is charged once it settles.
   *
   * Version 2 is the only pricing available to `flexible_http_request`, and is
   * to become the default for `http_request`.
   *
   * The usage of a call that reduces replication is assumed to be the same on
   * every node that performs it, and every node of a flexible committee is
   * assumed to respond.
   *
   * @param usage - the resources the outcall consumes.
   */
  httpOutcallV2: (usage: HttpOutcallUsage) => Currency;

  /**
   * Computes the payment an HTTP outcall priced by pricing version 2 has to
   * attach, given the usage it declares through the expectation fields of the
   * request. This is what `ic0.cost_http_request_v2` reports.
   *
   * It exceeds what {@link Calculator.httpOutcallV2} charges, because neither
   * how many nodes will respond nor which result they will produce is known
   * when the call is made, so the payment reserves for the most expensive
   * result the call could still produce. The difference is refunded.
   *
   * @param usage - the resources the outcall declares it expects to consume.
   */
  httpOutcallV2Payment: (usage: HttpOutcallUsage) => Currency;

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

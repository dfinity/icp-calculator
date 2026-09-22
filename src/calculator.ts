import * as CONFIG from "./icp/config.json";
import {
  Direction,
  Duration,
  Mode,
  Replication,
  SubnetType,
  type Bytes,
  type Calculator,
  type Cycles,
  type HttpOutcallUsage,
  type Instructions,
} from "./types";

const DEFAULT_SUBNET_TYPE = SubnetType.Application;
const DEFAULT_SUBNET_SIZE = 13;
const GiB = 1024 * 1024 * 1024;

// ==================== HTTP outcall pricing version 2 fees ====================
//
// Version 2 charges for the resources an outcall consumes instead of the bytes
// it reserves. Unlike the version 1 fees, these constants are not part of the
// subnet config, so they are not in `src/icp/config.json`, so they are pinned
// to the replica revision they were read from rather than to its branch. Every
// value below, and every expected value in the tests, holds at
// 79fce9ab76b15d1e31a545668300febd6f3c74fc. The corresponding code in replica:
// https://github.com/dfinity/ic/blob/79fce9ab76b15d1e31a545668300febd6f3c74fc/rs/https_outcalls/pricing/src/fees.rs

// Charged once per request, whatever it goes on to consume.
const HTTP_REQUEST_BASE_FEE = 1_000_000;
const HTTP_REQUEST_PER_BYTE_FEE = 50;
const HTTP_REQUEST_FULLY_REPLICATED_PER_NODE_FEE = 140_000;
const HTTP_REQUEST_FULLY_REPLICATED_QUADRATIC_NODE_FEE = 800;
const HTTP_REQUEST_FLEXIBLE_PER_NODE_FEE = 90_000;
const HTTP_REQUEST_FLEXIBLE_PER_NODE_RESPONSE_CONSENSUS_FEE = 2_000;
const HTTP_REQUEST_FLEXIBLE_PER_RESPONSE_CONSENSUS_FEE = 100_000;

// Charged to every node that performs the outcall, for what that node consumes.
const PER_DOWNLOADED_BYTE_FEE = 50;
const PER_RESPONSE_MS_FEE = 300;
const FLEXIBLE_PER_TRANSFORMED_BYTE_NODE_FEE = 50;
// Outcalls are priced against a reference subnet size of 13, and this is the
// only term that carries that constant, so a transform costs the same on every
// subnet. It is not the node count.
const TRANSFORM_INSTRUCTION_DIVISOR = 13;

// Charged for putting the responses that are delivered into a block.
const CONSENSUS_PER_NODE_BYTE_FEE = 10;
const CONSENSUS_BYTE_FEE = 600;
const FLEXIBLE_RESPONSE_SIZE_OVERHEAD = 181;

// ===================== HTTP outcall protocol limits =====================

/**
 * The largest response the protocol accepts, and what `max_response_bytes`
 * defaults to when a request leaves it unset.
 */
const MAX_HTTP_RESPONSE_BYTES = 2_000_000;

/**
 * Bytes reserved on top of `max_response_bytes` for the Candid encoding of a
 * delivered response, since `max_response_bytes` is enforced before encoding.
 */
const CANDID_OVERHEAD_RESERVE_BYTES = 1_024;

/**
 * The size of the largest reject a node may deliver. A reject is not bounded by
 * `max_response_bytes`, so every outcall has to reserve delivery for at least
 * this much, whatever size of response it asked for.
 */
const MAX_HTTP_REJECT_BYTES = 1_025;

/** The largest request the protocol accepts. */
const MAX_HTTP_REQUEST_BYTES = 2_000_000;

/** The longest the protocol waits for a response. */
const MAX_HTTP_ROUNDTRIP_TIME_MS = 60_000;

/** The instruction limit of a query call, which is what a transform runs as. */
const MAX_TRANSFORM_INSTRUCTIONS = 5_000_000_000;

/**
 * Clamps `value` into the range the protocol permits, as the whole number of
 * bytes, milliseconds, instructions or nodes that the protocol counts in.
 */
function bounded(value: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value), 0), max);
}

/** Integer division that rounds up, like the replica's `div_ceil`. */
function divCeil(value: number, divisor: number): number {
  return Math.ceil(value / divisor);
}

/**
 * The number of agreeing nodes required to deliver a fully replicated response
 * on a committee of `committeeSize` nodes.
 */
function canisterHttpThreshold(committeeSize: number): number {
  const n = Math.max(committeeSize, 1);
  const faultsTolerated = Math.floor((n - 1) / 3);
  return n - faultsTolerated;
}

/**
 * The usage to declare for an HTTP outcall that cannot run short of its
 * per-node limits: a response of the largest permitted size, downloaded over
 * the longest the protocol waits, transformed with the full query instruction
 * limit and delivered as a maximally large transformed response.
 *
 * Passing the result to `httpOutcallV2Payment` gives the payment that always
 * suffices, which is also the most the protocol withholds while the call is in
 * flight. Anything not spent is refunded.
 *
 * The delivered size it reports is `maxResponseBytes` plus the bytes the Candid
 * encoding of a response may add on top of it, since that encoded size is what
 * consensus puts into a block.
 *
 * @param args.request - the total serialized size of the request.
 * @param args.maxResponseBytes - the value of `max_response_bytes`, or
 * undefined if the request leaves it unset.
 * @param args.replication - which nodes perform the outcall.
 * @param args.totalRequests - flexible only: how many nodes perform the outcall.
 * @param args.minResponses - flexible only: how many responses have to agree.
 */
export function maxHttpOutcallUsage({
  request,
  maxResponseBytes,
  replication,
  totalRequests,
  minResponses,
}: {
  request: Bytes;
  maxResponseBytes?: Bytes;
  replication?: Replication;
  totalRequests?: number;
  minResponses?: number;
}): HttpOutcallUsage {
  const response = maxResponseBytes ?? (MAX_HTTP_RESPONSE_BYTES as Bytes);
  return {
    request,
    response,
    delivered: (response + CANDID_OVERHEAD_RESERVE_BYTES) as Bytes,
    roundtrip: Duration.fromMillis(MAX_HTTP_ROUNDTRIP_TIME_MS),
    transformInstructions: MAX_TRANSFORM_INSTRUCTIONS as Instructions,
    replication,
    totalRequests,
    minResponses,
  };
}

/** An {@link HttpOutcallUsage} with every default filled in. */
interface ResolvedUsage {
  request: number;
  response: number;
  delivered: number;
  roundtripMs: number;
  transformInstructions: number;
  replication: Replication;
  /** How many nodes perform the outcall. */
  nodes: number;
  minResponses: number;
  deliveredResponses: number;
}

/**
 * Constructs a cost calculator that operates in cycles for the given subnet.
 *
 * @param subnetType - the type of the subnet: application or system.
 * @param subnetSize - the number of nodes in the subnet.
 * @returns an object consisting of the replica version and the calculator.
 */
export function calculator({
  subnetType,
  subnetSize,
}: {
  subnetType?: SubnetType;
  subnetSize?: number;
}): { version: string; calculator: Calculator<Cycles> } {
  return {
    version: CONFIG.version,
    calculator: new CalculatorImpl(subnetType, subnetSize),
  };
}

class CalculatorImpl implements Calculator<Cycles> {
  private readonly subnetType: SubnetType;
  private readonly subnetSize: number;
  private readonly config: typeof CONFIG.application;

  constructor(subnetType?: SubnetType, subnetSize?: number) {
    this.subnetType = subnetType ?? DEFAULT_SUBNET_TYPE;
    this.subnetSize = subnetSize ?? DEFAULT_SUBNET_SIZE;
    switch (this.subnetType) {
      case SubnetType.Application:
        this.config = CONFIG.application;
        break;
      case SubnetType.System:
        this.config = CONFIG.system;
        break;
    }
  }

  storage(size: Bytes, duration: Duration): Cycles {
    // The corresponding code in replica:
    // https://github.com/dfinity/ic/blob/1999421a1a54a504d7a14e3d408d1d3cfc08879f/rs/cycles_account_manager/src/lib.rs#L631
    const fees = this.config.fees;
    const cost =
      (size * fees.gib_storage_per_second_fee * duration.asSeconds()) / GiB;
    return this.scale(cost as Cycles);
  }

  execution(mode: Mode, instructions: Instructions): Cycles {
    // The corresponding code in replica:
    // https://github.com/dfinity/ic/blob/1999421a1a54a504d7a14e3d408d1d3cfc08879f/rs/cycles_account_manager/src/lib.rs#L1032
    switch (mode) {
      case Mode.NonReplicated:
        return 0 as Cycles;
      case Mode.Replicated: {
        const fees = this.config.fees;
        const cost =
          fees.update_message_execution_fee +
          (fees.ten_update_instructions_execution_fee * instructions) / 10;
        return this.scale(cost as Cycles);
      }
    }
  }

  message(mode: Mode, direction: Direction, size: Bytes): Cycles {
    // The corresponding code in replica:
    // https://github.com/dfinity/ic/blob/1999421a1a54a504d7a14e3d408d1d3cfc08879f/rs/cycles_account_manager/src/lib.rs#L600
    // https://github.com/dfinity/ic/blob/1999421a1a54a504d7a14e3d408d1d3cfc08879f/rs/cycles_account_manager/src/lib.rs#L728

    // Returns per-message and per-byte fees depending on the direction.
    function messageFees(
      fees: typeof CONFIG.application.fees,
    ): [number, number] {
      switch (direction) {
        case Direction.UserToCanister:
          return [
            fees.ingress_message_reception_fee,
            fees.ingress_byte_reception_fee,
          ];
        case Direction.CanisterToCanister:
          return [fees.xnet_call_fee, fees.xnet_byte_transmission_fee];
      }
    }
    switch (mode) {
      case Mode.NonReplicated:
        return 0 as Cycles;
      case Mode.Replicated: {
        const [messageFee, byteFee] = messageFees(this.config.fees);
        const cost = messageFee + size * byteFee;
        return this.scale(cost as Cycles);
      }
    }
  }

  httpOutcall(request: Bytes, response: Bytes): Cycles {
    // The corresponding code in replica:
    // https://github.com/dfinity/ic/blob/1999421a1a54a504d7a14e3d408d1d3cfc08879f/rs/cycles_account_manager/src/lib.rs#L1080
    const fees = this.config.fees;
    const cost =
      (fees.http_request_linear_baseline_fee +
        fees.http_request_quadratic_baseline_fee * this.subnetSize +
        fees.http_request_per_byte_fee * request +
        fees.http_response_per_byte_fee * response) *
      this.subnetSize;
    // Note that additional scaling is not needed because the formula above
    // already accounts for the subnet size.
    return cost as Cycles;
  }

  httpOutcallV2(usage: HttpOutcallUsage): Cycles {
    // The corresponding code in replica, `initial_spent` and the per-replica
    // fees charged by the pay-as-you-go tracker:
    // https://github.com/dfinity/ic/blob/79fce9ab76b15d1e31a545668300febd6f3c74fc/rs/https_outcalls/pricing/src/fees.rs
    const u = this.resolveUsage(usage);
    const cost =
      this.baseFeeV2(u) +
      this.perReplicaFeeV2(u, u.delivered) * u.nodes +
      this.deliveryFeeV2(u);
    // Note that additional scaling is not needed because the formulas above
    // already account for the subnet size.
    return cost as Cycles;
  }

  httpOutcallV2Payment(usage: HttpOutcallUsage): Cycles {
    // The corresponding code in replica, `total_fee`:
    // https://github.com/dfinity/ic/blob/79fce9ab76b15d1e31a545668300febd6f3c74fc/rs/https_outcalls/pricing/src/fees.rs
    const u = this.resolveUsage(usage);
    // Whatever was asked for, a reject of this size may be delivered instead,
    // and delivering it has to be funded out of the same per-node allowances.
    const deliverable = Math.max(u.delivered, MAX_HTTP_REJECT_BYTES);
    // The reserve is split evenly across the nodes that perform the outcall, so
    // each of them has to hold a whole share of it.
    const perNodeDelivery = divCeil(
      this.maxDeliveryFeeV2(u, deliverable),
      u.nodes,
    );
    const cost =
      this.baseFeeV2(u) +
      (this.perReplicaFeeV2(u, deliverable) + perNodeDelivery) * u.nodes;
    return cost as Cycles;
  }

  /**
   * Fills in every default of `usage`, which needs the subnet size, and holds
   * it to what the protocol permits, so that no outcall is priced for more than
   * it could ever consume or for more responses than it has nodes to produce
   * them.
   */
  private resolveUsage(usage: HttpOutcallUsage): ResolvedUsage {
    const replication = usage.replication ?? Replication.FullyReplicated;
    const subnetNodes = Math.max(this.subnetSize, 1);
    const nodes = {
      [Replication.FullyReplicated]: subnetNodes,
      [Replication.NonReplicated]: 1,
      // A committee cannot be larger than the subnet it is drawn from.
      [Replication.Flexible]: Math.max(
        bounded(usage.totalRequests ?? subnetNodes, subnetNodes),
        1,
      ),
    }[replication];
    // A non-replicated outcall is priced as a flexible one that requires a
    // single response. A flexible one that does not say how many responses it
    // requires takes the two thirds of its committee that the protocol
    // defaults to, which is the whole subnet unless the call narrowed it.
    const minResponses =
      replication === Replication.NonReplicated
        ? 1
        : bounded(usage.minResponses ?? Math.floor((2 * nodes) / 3) + 1, nodes);
    return {
      request: bounded(usage.request, MAX_HTTP_REQUEST_BYTES),
      response: bounded(usage.response, MAX_HTTP_RESPONSE_BYTES),
      delivered: bounded(
        usage.delivered ?? usage.response,
        MAX_HTTP_RESPONSE_BYTES + CANDID_OVERHEAD_RESERVE_BYTES,
      ),
      roundtripMs: bounded(
        usage.roundtrip?.asMillis() ?? 0,
        MAX_HTTP_ROUNDTRIP_TIME_MS,
      ),
      transformInstructions: bounded(
        usage.transformInstructions ?? 0,
        MAX_TRANSFORM_INSTRUCTIONS,
      ),
      replication,
      nodes,
      minResponses,
      deliveredResponses: bounded(
        usage.deliveredResponses ?? minResponses,
        nodes,
      ),
    };
  }

  /** The fee charged up-front for every request. */
  private baseFeeV2(u: ResolvedUsage): number {
    const n = this.subnetSize;
    const perRequest =
      HTTP_REQUEST_BASE_FEE + HTTP_REQUEST_PER_BYTE_FEE * u.request;
    if (u.replication === Replication.FullyReplicated) {
      return (
        (perRequest +
          HTTP_REQUEST_FULLY_REPLICATED_PER_NODE_FEE * n +
          HTTP_REQUEST_FULLY_REPLICATED_QUADRATIC_NODE_FEE * n * n) *
        n
      );
    }
    return (
      (perRequest +
        HTTP_REQUEST_FLEXIBLE_PER_NODE_FEE * n +
        HTTP_REQUEST_FLEXIBLE_PER_NODE_RESPONSE_CONSENSUS_FEE *
          n *
          u.minResponses +
        HTTP_REQUEST_FLEXIBLE_PER_RESPONSE_CONSENSUS_FEE * u.minResponses) *
      n
    );
  }

  /**
   * What one node that performs the outcall is charged for downloading the
   * response, running the transform, and, unless the outcall is fully
   * replicated, gossiping `gossiped` bytes of result to the rest of the subnet.
   */
  private perReplicaFeeV2(u: ResolvedUsage, gossiped: number): number {
    const gossip =
      u.replication === Replication.FullyReplicated
        ? 0
        : FLEXIBLE_PER_TRANSFORMED_BYTE_NODE_FEE * gossiped * this.subnetSize;
    return (
      PER_DOWNLOADED_BYTE_FEE * u.response +
      PER_RESPONSE_MS_FEE * u.roundtripMs +
      Math.floor(u.transformInstructions / TRANSFORM_INSTRUCTION_DIVISOR) +
      gossip
    );
  }

  /** The fee for putting `bytes` many response bytes into a block. */
  private consensusFeeV2(bytes: number): number {
    const n = this.subnetSize;
    return (CONSENSUS_PER_NODE_BYTE_FEE * n + CONSENSUS_BYTE_FEE) * n * bytes;
  }

  /** The surcharge for flexible responses beyond the ones consensus requires. */
  private flexibleExtraResponseFeeV2(extraResponses: number): number {
    const n = this.subnetSize;
    return (
      (HTTP_REQUEST_FLEXIBLE_PER_NODE_RESPONSE_CONSENSUS_FEE * n +
        HTTP_REQUEST_FLEXIBLE_PER_RESPONSE_CONSENSUS_FEE) *
      n *
      Math.max(extraResponses, 0)
    );
  }

  /** What delivering the results of the outcall is actually charged. */
  private deliveryFeeV2(u: ResolvedUsage): number {
    if (u.replication !== Replication.Flexible) {
      return this.consensusFeeV2(u.delivered);
    }
    const delivered = u.deliveredResponses;
    if (delivered === 0) {
      // Fire and forget: no response is delivered, so none is put into a block.
      return 0;
    }
    return (
      this.consensusFeeV2(
        delivered * (FLEXIBLE_RESPONSE_SIZE_OVERHEAD + u.delivered),
      ) + this.flexibleExtraResponseFeeV2(delivered - u.minResponses)
    );
  }

  /**
   * What delivering the results of the outcall reserves, which exceeds
   * {@link CalculatorImpl.deliveryFeeV2} so that every result the outcall could
   * produce is self-funding out of the per-node allowances.
   */
  private maxDeliveryFeeV2(u: ResolvedUsage, deliverable: number): number {
    switch (u.replication) {
      case Replication.NonReplicated:
        return this.consensusFeeV2(deliverable);
      case Replication.FullyReplicated: {
        // Only a quorum of the nodes contributes to the result, but the reserve
        // is split across the whole subnet, so each contributor has to hold the
        // share of the delivery that the quorum leaves it.
        const n = u.nodes;
        return (
          divCeil(this.consensusFeeV2(deliverable), canisterHttpThreshold(n)) *
          n
        );
      }
      case Replication.Flexible: {
        if (u.deliveredResponses === 0) {
          return 0;
        }
        // Priced for every node of the committee responding, rather than for
        // the responses that are delivered, so that each node's allowance can
        // cover delivering its own response.
        const responses = Math.max(u.nodes, 1);
        return (
          this.consensusFeeV2(
            responses * (FLEXIBLE_RESPONSE_SIZE_OVERHEAD + deliverable),
          ) + this.flexibleExtraResponseFeeV2(responses - u.minResponses)
        );
      }
    }
  }

  canisterCreation(): Cycles {
    // The corresponding code in replica:
    // https://github.com/dfinity/ic/blob/1999421a1a54a504d7a14e3d408d1d3cfc08879f/rs/cycles_account_manager/src/lib.rs#L216
    const fees = this.config.fees;
    return this.scale(fees.canister_creation_fee as Cycles);
  }

  computeAllocation(percent: number, duration: Duration): Cycles {
    // The corresponding code in replica:
    // https://github.com/dfinity/ic/blob/1999421a1a54a504d7a14e3d408d1d3cfc08879f/rs/cycles_account_manager/src/lib.rs#L544
    const fees = this.config.fees;
    const fee = fees.compute_percent_allocated_per_second_fee;
    const cost = fee * duration.asSeconds() * percent;
    return this.scale(cost as Cycles);
  }

  memoryAllocation(bytes: Bytes, duration: Duration): Cycles {
    // The corresponding code in replica:
    // https://github.com/dfinity/ic/blob/1a14c58d3148f06a592e5cba738d313af55f087b/rs/cycles_account_manager/src/lib.rs#L285
    return this.storage(bytes, duration);
  }

  signWithEcdsa(args: Bytes, signature: Bytes): Cycles {
    // The corresponding code in replica:
    // https://github.com/dfinity/ic/blob/1a14c58d3148f06a592e5cba738d313af55f087b/rs/execution_environment/src/execution_environment.rs#L2640
    const fees = this.config.fees;
    const fee = fees.ecdsa_signature_fee as Cycles;
    const bytes = (args + signature) as Bytes;
    const call = this.message(
      Mode.Replicated,
      Direction.CanisterToCanister,
      bytes,
    );
    return (call + this.scale(fee)) as Cycles;
  }

  signWithSchnorr(args: Bytes, signature: Bytes): Cycles {
    // The corresponding code in replica:
    // https://github.com/dfinity/ic/blob/1a14c58d3148f06a592e5cba738d313af55f087b/rs/execution_environment/src/execution_environment.rs#L2640
    const fees = this.config.fees;
    const fee = fees.schnorr_signature_fee as Cycles;
    const bytes = (args + signature) as Bytes;
    const call = this.message(
      Mode.Replicated,
      Direction.CanisterToCanister,
      bytes,
    );
    return (call + this.scale(fee)) as Cycles;
  }

  scale(value: Cycles): Cycles {
    // The corresponding code in replica:
    // https://github.com/dfinity/ic/blob/1999421a1a54a504d7a14e3d408d1d3cfc08879f/rs/cycles_account_manager/src/lib.rs#L205
    return ((value * this.subnetSize) / DEFAULT_SUBNET_SIZE) as Cycles;
  }
}

import * as CONFIG from "./icp/config.json";
import {
  Direction,
  Mode,
  SubnetType,
  type Bytes,
  type Calculator,
  type Cycles,
  type Duration,
  type Instructions,
} from "./types";

const DEFAULT_SUBNET_TYPE = SubnetType.Application;
const DEFAULT_SUBNET_SIZE = 13;
const GiB = 1024 * 1024 * 1024;

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

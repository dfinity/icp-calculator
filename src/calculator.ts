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
 * @returns a tuple consisting of the replica version and the calculator.
 */
export function calculator(
  subnetType?: SubnetType,
  subnetSize?: number,
): [string, Calculator<Cycles>] {
  return [CONFIG.version, new CalculatorImpl(subnetType, subnetSize)];
}

class CalculatorImpl implements Calculator<Cycles> {
  subnet_type: SubnetType;
  subnet_size: number;
  config: typeof CONFIG.application;

  constructor(subnetType?: SubnetType, subnetSize?: number) {
    this.subnet_type = subnetType ?? DEFAULT_SUBNET_TYPE;
    this.subnet_size = subnetSize ?? DEFAULT_SUBNET_SIZE;
    this.config =
      this.subnet_type === SubnetType.Application
        ? CONFIG.application
        : CONFIG.system;
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
    if (mode === Mode.NonReplicated) {
      return 0 as Cycles;
    }
    const fees = this.config.fees;
    const cost =
      fees.update_message_execution_fee +
      (fees.ten_update_instructions_execution_fee * instructions) / 10;
    return this.scale(cost as Cycles);
  }

  message(mode: Mode, direction: Direction, size: Bytes): Cycles {
    // The corresponding code in replica:
    // https://github.com/dfinity/ic/blob/1999421a1a54a504d7a14e3d408d1d3cfc08879f/rs/cycles_account_manager/src/lib.rs#L600
    // https://github.com/dfinity/ic/blob/1999421a1a54a504d7a14e3d408d1d3cfc08879f/rs/cycles_account_manager/src/lib.rs#L728
    if (mode === Mode.NonReplicated) {
      return 0 as Cycles;
    }
    const fees = this.config.fees;
    const [messageFee, byteFee] =
      direction === Direction.UserToCanister
        ? [fees.ingress_message_reception_fee, fees.ingress_byte_reception_fee]
        : [fees.xnet_call_fee, fees.xnet_byte_transmission_fee];
    const cost = messageFee + size * byteFee;
    return this.scale(cost as Cycles);
  }

  httpOutcall(request: Bytes, response: Bytes): Cycles {
    // The corresponding code in replica:
    // https://github.com/dfinity/ic/blob/1999421a1a54a504d7a14e3d408d1d3cfc08879f/rs/cycles_account_manager/src/lib.rs#L1080
    const fees = this.config.fees;
    const cost =
      (fees.http_request_linear_baseline_fee +
        fees.http_request_quadratic_baseline_fee * this.subnet_size +
        fees.http_request_per_byte_fee * request +
        fees.http_response_per_byte_fee * response) *
      this.subnet_size;
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

  scale(value: Cycles): Cycles {
    // The corresponding code in replica:
    // https://github.com/dfinity/ic/blob/1999421a1a54a504d7a14e3d408d1d3cfc08879f/rs/cycles_account_manager/src/lib.rs#L205
    return ((value * this.subnet_size) / DEFAULT_SUBNET_SIZE) as Cycles;
  }
}

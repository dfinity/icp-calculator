import {
  Direction,
  Duration,
  Mode,
  SubnetType,
  calculators,
  type Bytes,
  type Instructions,
} from "./index";

const GiB = (1024 * 1024 * 1024) as Bytes;

it("should compute storage cost on a 13-node subnet", () => {
  const cycles = calculators().calculatorCycles;
  const $ = calculators().calculatorUSD;

  expect(cycles.storage(GiB, Duration.fromDays(365))).toBeCloseTo(
    127_000 * 365 * 24 * 3600,
  );
  expect($.storage(GiB, Duration.fromDays(365))).toBeCloseTo(5.305);
});

it("should compute storage cost on a 34-node subnet", () => {
  const cycles = calculators({ subnetSize: 34 }).calculatorCycles;
  const $ = calculators({ subnetSize: 34 }).calculatorUSD;

  expect(cycles.storage(GiB, Duration.fromDays(365))).toBeCloseTo(
    (127_000 * 365 * 24 * 3600 * 34) / 13,
  );
  expect($.storage(GiB, Duration.fromDays(365))).toBeCloseTo((5.305 * 34) / 13);
});

it("should compute execution cost on a 13-node subnet", () => {
  const cycles = calculators().calculatorCycles;
  const $ = calculators().calculatorUSD;

  const mode = Mode.Replicated;
  const instr = 1_000_000 as Instructions;

  expect(cycles.execution(mode, instr)).toBeCloseTo(590_000 + 0.4 * instr);
  expect($.execution(mode, instr)).toBeCloseTo(1.31e-6, 8);
});

it("should compute execution cost on a 34-node subnet", () => {
  const cycles = calculators({ subnetSize: 34 }).calculatorCycles;
  const $ = calculators({ subnetSize: 34 }).calculatorUSD;

  const mode = Mode.Replicated;
  const instr = 1_000_000 as Instructions;

  expect(cycles.execution(mode, instr)).toBeCloseTo(
    ((590_000 + 0.4 * instr) * 34) / 13,
  );
  expect($.execution(mode, instr)).toBeCloseTo((1.31e-6 * 34) / 13, 8);
});

it("should compute user message cost on a 13-node subnet", () => {
  const cycles = calculators().calculatorCycles;
  const $ = calculators().calculatorUSD;

  const mode = Mode.Replicated;
  const dir = Direction.UserToCanister;
  const bytes = 1_000_000 as Bytes;

  expect(cycles.message(mode, dir, bytes)).toBeCloseTo(
    1_200_000 + 2_000 * bytes,
  );
  expect($.message(mode, dir, bytes)).toBeCloseTo(0.00265, 5);
});

it("should compute user message cost on a 34-node subnet", () => {
  const cycles = calculators({ subnetSize: 34 }).calculatorCycles;
  const $ = calculators({ subnetSize: 34 }).calculatorUSD;

  const mode = Mode.Replicated;
  const dir = Direction.UserToCanister;
  const bytes = 1_000_000 as Bytes;

  expect(cycles.message(mode, dir, bytes)).toBeCloseTo(
    ((1_200_000 + 2_000 * bytes) * 34) / 13,
  );
  expect($.message(mode, dir, bytes)).toBeCloseTo((0.00265 * 34) / 13, 5);
});

it("should compute canister message cost on a 13-node subnet", () => {
  const cycles = calculators().calculatorCycles;
  const $ = calculators().calculatorUSD;

  const mode = Mode.Replicated;
  const dir = Direction.CanisterToCanister;
  const bytes = 1_000_000 as Bytes;

  expect(cycles.message(mode, dir, bytes)).toBeCloseTo(260_000 + 1_000 * bytes);
  expect($.message(mode, dir, bytes)).toBeCloseTo(0.001325, 5);
});

it("should compute canister message cost on a 34-node subnet", () => {
  const cycles = calculators({ subnetSize: 34 }).calculatorCycles;
  const $ = calculators({ subnetSize: 34 }).calculatorUSD;

  const mode = Mode.Replicated;
  const dir = Direction.CanisterToCanister;
  const bytes = 1_000_000 as Bytes;

  expect(cycles.message(mode, dir, bytes)).toBeCloseTo(
    ((260_000 + 1_000 * bytes) * 34) / 13,
  );
  expect($.message(mode, dir, bytes)).toBeCloseTo((0.001325 * 34) / 13, 5);
});

it("should compute HTTP outcall cost on a 13-node subnet", () => {
  const cycles = calculators().calculatorCycles;
  const $ = calculators().calculatorUSD;

  const request = 1_000_000 as Bytes;
  const response = 2_000_000 as Bytes;

  expect(cycles.httpOutcall(request, response)).toBeCloseTo(
    49_140_000 + 5_200 * request + 10_400 * response,
  );
  expect($.httpOutcall(request, response)).toBeCloseTo(0.0345, 5);
});

it("should compute HTTP outcall cost on a 34-node subnet", () => {
  const cycles = calculators({ subnetSize: 34 }).calculatorCycles;
  const $ = calculators({ subnetSize: 34 }).calculatorUSD;

  const request = 1_000_000 as Bytes;
  const response = 2_000_000 as Bytes;

  expect(cycles.httpOutcall(request, response)).toBeCloseTo(
    171_360_000 + 13_600 * request + 27_200 * response,
  );
  expect($.httpOutcall(request, response)).toBeCloseTo(0.09, 3);
});

it("should compute canister creation cost on a 13-node subnet", () => {
  const cycles = calculators().calculatorCycles;
  const $ = calculators().calculatorUSD;

  expect(cycles.canisterCreation()).toBeCloseTo(100_000_000_000);
  expect($.canisterCreation()).toBeCloseTo(0.132);
});

it("should compute canister creation cost on a 34-node subnet", () => {
  const cycles = calculators({ subnetSize: 34 }).calculatorCycles;
  const $ = calculators({ subnetSize: 34 }).calculatorUSD;

  expect(cycles.canisterCreation()).toBeCloseTo((100_000_000_000 * 34) / 13);
  expect($.canisterCreation()).toBeCloseTo((0.132 * 34) / 13);
});

it("should compute compute allocation cost on a 13-node subnet", () => {
  const cycles = calculators().calculatorCycles;
  const $ = calculators().calculatorUSD;

  expect(cycles.computeAllocation(1, Duration.fromDays(365))).toBeCloseTo(
    10_000_000 * 365 * 24 * 3600,
  );
  expect($.computeAllocation(1, Duration.fromDays(365))).toBeCloseTo(417.695);
});

it("should compute compute allocation cost on a 34-node subnet", () => {
  const cycles = calculators({ subnetSize: 34 }).calculatorCycles;
  const $ = calculators({ subnetSize: 34 }).calculatorUSD;

  expect(cycles.computeAllocation(1, Duration.fromDays(365))).toBeCloseTo(
    (10_000_000 * 365 * 24 * 3600 * 34) / 13,
  );
  expect($.computeAllocation(1, Duration.fromDays(365))).toBeCloseTo(
    (417.695 * 34) / 13,
  );
});

it("should compute memory allocation cost on a 13-node subnet", () => {
  const cycles = calculators().calculatorCycles;
  const $ = calculators().calculatorUSD;

  expect(cycles.memoryAllocation(GiB, Duration.fromDays(365))).toBeCloseTo(
    127_000 * 365 * 24 * 3600,
  );
  expect($.memoryAllocation(GiB, Duration.fromDays(365))).toBeCloseTo(5.305);
});

it("should compute memory allocation cost on a 34-node subnet", () => {
  const cycles = calculators({ subnetSize: 34 }).calculatorCycles;
  const $ = calculators({ subnetSize: 34 }).calculatorUSD;

  expect(cycles.memoryAllocation(GiB, Duration.fromDays(365))).toBeCloseTo(
    (127_000 * 365 * 24 * 3600 * 34) / 13,
  );
  expect($.memoryAllocation(GiB, Duration.fromDays(365))).toBeCloseTo(
    (5.305 * 34) / 13,
  );
});

it("should compute memory allocation cost on a 34-node subnet", () => {
  const cycles = calculators({ subnetSize: 34 }).calculatorCycles;
  const $ = calculators({ subnetSize: 34 }).calculatorUSD;

  expect(cycles.memoryAllocation(GiB, Duration.fromDays(365))).toBeCloseTo(
    (127_000 * 365 * 24 * 3600 * 34) / 13,
  );
  expect($.memoryAllocation(GiB, Duration.fromDays(365))).toBeCloseTo(
    (5.305 * 34) / 13,
  );
});

it("should compute ECDSA signing cost on a 13-node subnet", () => {
  const cycles = calculators().calculatorCycles;
  const $ = calculators().calculatorUSD;

  expect(cycles.signWithEcdsa(64 as Bytes, 64 as Bytes)).toBeCloseTo(
    260_000 + 1_000 * (64 + 64) + 10_000_000_000,
  );
  expect($.signWithEcdsa(64 as Bytes, 64 as Bytes)).toBeCloseTo(0.0132);
});

it("should compute ECDSA signing cost on a 34-node subnet", () => {
  const cycles = calculators({ subnetSize: 34 }).calculatorCycles;
  const $ = calculators({ subnetSize: 34 }).calculatorUSD;

  expect(cycles.signWithEcdsa(64 as Bytes, 64 as Bytes)).toBeCloseTo(
    ((260_000 + 1_000 * (64 + 64) + 10_000_000_000) * 34) / 13,
  );
  expect($.signWithEcdsa(64 as Bytes, 64 as Bytes)).toBeCloseTo(
    (0.0132 * 34) / 13,
  );
});

it("should compute Schnorr signing cost on a 13-node subnet", () => {
  const cycles = calculators().calculatorCycles;
  const $ = calculators().calculatorUSD;

  expect(cycles.signWithSchnorr(64 as Bytes, 64 as Bytes)).toBeCloseTo(
    260_000 + 1_000 * (64 + 64) + 10_000_000_000,
  );
  expect($.signWithSchnorr(64 as Bytes, 64 as Bytes)).toBeCloseTo(0.0132);
});

it("should compute Schnorr signing cost on a 34-node subnet", () => {
  const cycles = calculators({ subnetSize: 34 }).calculatorCycles;
  const $ = calculators({ subnetSize: 34 }).calculatorUSD;

  expect(cycles.signWithSchnorr(64 as Bytes, 64 as Bytes)).toBeCloseTo(
    ((260_000 + 1_000 * (64 + 64) + 10_000_000_000) * 34) / 13,
  );
  expect($.signWithSchnorr(64 as Bytes, 64 as Bytes)).toBeCloseTo(
    (0.0132 * 34) / 13,
  );
});

it("should compute non-replicated mode costs as zero", () => {
  const cycles = calculators().calculatorCycles;
  const $ = calculators().calculatorUSD;

  const mode = Mode.NonReplicated;
  const instr = 1_000_000 as Instructions;
  const bytes = 1_000_000 as Bytes;

  expect(cycles.execution(mode, instr)).toBeCloseTo(0);
  expect($.execution(mode, instr)).toBeCloseTo(0);
  expect(cycles.message(mode, Direction.UserToCanister, bytes)).toBeCloseTo(0);
  expect($.message(mode, Direction.UserToCanister, bytes)).toBeCloseTo(0);
  expect(cycles.message(mode, Direction.CanisterToCanister, bytes)).toBeCloseTo(
    0,
  );
  expect($.message(mode, Direction.CanisterToCanister, bytes)).toBeCloseTo(0);
});

it("should compute system subnet costs as zero", () => {
  const cycles = calculators({
    subnetType: SubnetType.System,
  }).calculatorCycles;
  const $ = calculators({ subnetType: SubnetType.System }).calculatorUSD;

  const mode = Mode.Replicated;
  const instr = 1_000_000 as Instructions;
  const bytes = 1_000_000 as Bytes;

  expect(cycles.storage(bytes, Duration.fromDays(365))).toBeCloseTo(0);
  expect($.storage(bytes, Duration.fromDays(365))).toBeCloseTo(0);
  expect(cycles.execution(mode, instr)).toBeCloseTo(0);
  expect($.execution(mode, instr)).toBeCloseTo(0);
  expect(cycles.message(mode, Direction.UserToCanister, bytes)).toBeCloseTo(0);
  expect($.message(mode, Direction.UserToCanister, bytes)).toBeCloseTo(0);
  expect(cycles.message(mode, Direction.CanisterToCanister, bytes)).toBeCloseTo(
    0,
  );
  expect($.message(mode, Direction.CanisterToCanister, bytes)).toBeCloseTo(0);
  expect(cycles.httpOutcall(bytes, bytes)).toBeCloseTo(0);
  expect($.httpOutcall(bytes, bytes)).toBeCloseTo(0);
  expect(cycles.canisterCreation()).toBeCloseTo(0);
  expect($.canisterCreation()).toBeCloseTo(0);
});

it("should returns some replica version", () => {
  expect(calculators().version).toBeDefined();
});

it("should run the example from README", () => {
  const $ = calculators().calculatorUSD;
  const storage1mb = $.storage(1_000_000 as Bytes, Duration.fromDays(365));
  const execute1b = $.execution(Mode.Replicated, 1_000_000_000 as Instructions);
  const send1mb = $.message(
    Mode.Replicated,
    Direction.UserToCanister,
    1_000_000 as Bytes,
  );
  expect(storage1mb).toBeCloseTo(0.00494, 5);
  expect(execute1b).toBeCloseTo(0.00053, 5);
  expect(send1mb).toBeCloseTo(0.00265, 5);
});

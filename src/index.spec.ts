import {
  Direction,
  Duration,
  Mode,
  Replication,
  SubnetType,
  calculators,
  maxHttpOutcallUsage,
  type Bytes,
  type HttpOutcallUsage,
  type Instructions,
} from "./index";

/**
 * The resource usage the pricing version 2 tests below price: a 100-byte
 * request whose 1,000-byte response arrived in 2,000 ms, was transformed with
 * 26 instructions and ended up 2,000 bytes long.
 *
 * It is the same usage the replica's own `total_fee` tests price, so the
 * expected values below are the ones asserted in
 * https://github.com/dfinity/ic/blob/79fce9ab76b15d1e31a545668300febd6f3c74fc/rs/https_outcalls/pricing/src/fees.rs
 */
const USAGE: HttpOutcallUsage = {
  request: 100 as Bytes,
  response: 1_000 as Bytes,
  delivered: 2_000 as Bytes,
  roundtrip: Duration.fromMillis(2_000),
  transformInstructions: 26 as Instructions,
};

/** `50 * 1_000 + 300 * 2_000 + floor(26 / 13)`, what one node consumes. */
const PER_NODE_USAGE_FEE = 650_002;

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

  expect(cycles.execution(mode, instr)).toBeCloseTo(5_000_000 + 1 * instr);
  expect($.execution(mode, instr)).toBeCloseTo(7.947e-6, 8);
});

it("should compute execution cost on a 34-node subnet", () => {
  const cycles = calculators({ subnetSize: 34 }).calculatorCycles;
  const $ = calculators({ subnetSize: 34 }).calculatorUSD;

  const mode = Mode.Replicated;
  const instr = 1_000_000 as Instructions;

  expect(cycles.execution(mode, instr)).toBeCloseTo(
    ((5_000_000 + 1 * instr) * 34) / 13,
  );
  expect($.execution(mode, instr)).toBeCloseTo((7.947e-6 * 34) / 13, 8);
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

it("should compute the version 2 payment of a fully replicated outcall", () => {
  const cycles = calculators().calculatorCycles;

  // All 13 nodes produce the same response, whose dissemination is charged as a
  // consensus fee rather than a per-node gossip fee.
  //   base fee    = 13 * (1_000_000 + 50*100 + 140_000*13 + 800*13*13) = 38_482_600
  //   per node    = 13 * 650_002                                       =  8_450_026
  //   consensus   = ceil(9_490 * 2_000 / 9) * 13                       = 27_415_557
  expect(cycles.httpOutcallV2Payment(USAGE)).toBe(
    38_482_600 + 13 * PER_NODE_USAGE_FEE + 27_415_557,
  );
});

it("should compute the version 2 payment of a non-replicated outcall", () => {
  const cycles = calculators().calculatorCycles;
  const usage = { ...USAGE, replication: Replication.NonReplicated };

  // A single node performs the outcall and gossips its response to all 13
  // nodes; the base fee is the flexible one with one required response.
  //   base fee    = 13 * (1_000_000 + 50*100 + 90_000*13 + 2_000*13 + 100_000)
  //                                                        = 29_913_000
  //   per node    = 1 * (650_002 + 50*2_000*13)            =  1_950_002
  //   consensus   = 9_490 * 2_000                          = 18_980_000
  expect(cycles.httpOutcallV2Payment(usage)).toBe(
    29_913_000 + (PER_NODE_USAGE_FEE + 50 * 2_000 * 13) + 18_980_000,
  );

  // The payment is priced for exactly the usage it declares, and one node
  // either delivers that response or a smaller reject, so there is nothing to
  // refund.
  expect(cycles.httpOutcallV2(usage)).toBe(cycles.httpOutcallV2Payment(usage));
});

it("should compute the version 2 payment of a flexible outcall", () => {
  const cycles = calculators().calculatorCycles;
  const usage = {
    ...USAGE,
    replication: Replication.Flexible,
    totalRequests: 3,
    minResponses: 2,
  };

  // 3 nodes perform the outcall, 2 of whose responses suffice, so all 3 gossip
  // their own response and up to 3 responses are delivered, one of them beyond
  // the 2 that are required.
  //   base fee    = 13 * (1_000_000 + 50*100 + 90_000*13 + 2_000*13*2 + 100_000*2)
  //                                                        = 31_551_000
  //   per node    = 3 * (650_002 + 50*2_000*13)            =  5_850_006
  //   consensus   = 9_490 * 3 * (181 + 2_000)              = 62_093_070
  //   extra resp. = (3 - 2) * 13 * (2_000*13 + 100_000)    =  1_638_000
  expect(cycles.httpOutcallV2Payment(usage)).toBe(
    31_551_000 +
      3 * (PER_NODE_USAGE_FEE + 50 * 2_000 * 13) +
      62_093_070 +
      1_638_000,
  );

  // Asking for fewer responses than there are nodes does not lower the payment:
  // every one of them is still priced for delivering a response, since each
  // holds only a third of the fee.
  expect(cycles.httpOutcallV2Payment({ ...usage, deliveredResponses: 2 })).toBe(
    cycles.httpOutcallV2Payment(usage),
  );

  // Which is also why delivering a response from every node refunds nothing.
  expect(cycles.httpOutcallV2({ ...usage, deliveredResponses: 3 })).toBe(
    cycles.httpOutcallV2Payment(usage),
  );
});

it("should price every version 2 response for at least a maximal reject", () => {
  const cycles = calculators().calculatorCycles;

  // Whatever response size is asked for, a reject of up to 1,025 bytes may be
  // delivered in its place, so the payment is priced for at least that many.
  for (const replication of [
    Replication.FullyReplicated,
    Replication.NonReplicated,
    Replication.Flexible,
  ]) {
    const floored = cycles.httpOutcallV2Payment({
      ...USAGE,
      delivered: 1_025 as Bytes,
      replication,
    });
    for (const delivered of [0, 1, 500, 1_024, 1_025]) {
      expect(
        cycles.httpOutcallV2Payment({
          ...USAGE,
          delivered: delivered as Bytes,
          replication,
        }),
      ).toBe(floored);
    }
  }
});

it("should charge version 2 for what an outcall consumes", () => {
  const cycles = calculators().calculatorCycles;

  //   base fee    = 38_482_600, per node = 13 * 650_002, delivery = 9_490 * 2_000
  const charge = 38_482_600 + 13 * PER_NODE_USAGE_FEE + 18_980_000;
  expect(cycles.httpOutcallV2(USAGE)).toBe(charge);

  // The charge falls short of the payment, and the difference is refunded.
  expect(charge).toBeLessThan(cycles.httpOutcallV2Payment(USAGE));

  // Each input is charged at the rate documented for a 13-node subnet.
  const more = (extra: Partial<HttpOutcallUsage>): number =>
    cycles.httpOutcallV2({ ...USAGE, ...extra }) - charge;
  expect(more({ request: 101 as Bytes })).toBe(650);
  expect(more({ response: 1_001 as Bytes })).toBe(650);
  expect(more({ roundtrip: Duration.fromMillis(2_001) })).toBe(3_900);
  expect(more({ transformInstructions: 39 as Instructions })).toBe(13);
  expect(more({ delivered: 2_001 as Bytes })).toBe(9_490);
});

it("should charge version 2 per node on a 34-node subnet", () => {
  const cycles = calculators({ subnetSize: 34 }).calculatorCycles;

  const charge = cycles.httpOutcallV2(USAGE);
  //   base fee = 34 * (1_000_000 + 50*100 + 140_000*34 + 800*34*34)
  //   per node = 34 * 650_002, delivery = 34 * (10*34 + 600) * 2_000
  expect(charge).toBe(
    34 * (1_000_000 + 50 * 100 + 140_000 * 34 + 800 * 34 * 34) +
      34 * PER_NODE_USAGE_FEE +
      34 * (10 * 34 + 600) * 2_000,
  );

  const more = (extra: Partial<HttpOutcallUsage>): number =>
    cycles.httpOutcallV2({ ...USAGE, ...extra }) - charge;
  expect(more({ request: 101 as Bytes })).toBe(1_700);
  expect(more({ response: 1_001 as Bytes })).toBe(1_700);
  expect(more({ roundtrip: Duration.fromMillis(2_001) })).toBe(10_200);
  expect(more({ delivered: 2_001 as Bytes })).toBe(31_960);

  // Every node is charged the same for a transform whatever subnet it is on,
  // since the instruction count is divided by the reference subnet size rather
  // than by the node count. What scales with the subnet is only how many nodes
  // run the transform, which is why the totals below differ.
  const transform = (nodes: number): number =>
    calculators({ subnetSize: nodes }).calculatorCycles.httpOutcallV2({
      ...USAGE,
      transformInstructions: 13_000_000 as Instructions,
    }) -
    calculators({ subnetSize: nodes }).calculatorCycles.httpOutcallV2(USAGE);
  expect(transform(13)).toBe(13 * (1_000_000 - 2));
  expect(transform(34)).toBe(34 * (1_000_000 - 2));
});

it("should default a flexible outcall to the whole subnet", () => {
  const cycles = calculators().calculatorCycles;

  // Every node performs the outcall and floor(2 / 3 * 13) + 1 = 9 responses
  // are required, of which 9 are delivered.
  expect(
    cycles.httpOutcallV2({ ...USAGE, replication: Replication.Flexible }),
  ).toBe(
    cycles.httpOutcallV2({
      ...USAGE,
      replication: Replication.Flexible,
      totalRequests: 13,
      minResponses: 9,
      deliveredResponses: 9,
    }),
  );
});

it("should derive the flexible defaults from the committee, not the subnet", () => {
  const cycles = calculators().calculatorCycles;

  // A call that narrows its committee to 3 of the 13 nodes requires two thirds
  // of those 3, not of the subnet, so it can never be priced for delivering
  // more responses than it has nodes to produce them.
  const narrowed = {
    ...USAGE,
    replication: Replication.Flexible,
    totalRequests: 3,
  };
  expect(cycles.httpOutcallV2(narrowed)).toBe(
    cycles.httpOutcallV2({
      ...narrowed,
      minResponses: 3, // floor(2 / 3 * 3) + 1
      deliveredResponses: 3,
    }),
  );

  // Asking for more responses than the committee can give is held to it.
  for (const counts of [
    { minResponses: 9 },
    { deliveredResponses: 9 },
    { minResponses: 99, deliveredResponses: 99 },
  ]) {
    expect(cycles.httpOutcallV2({ ...narrowed, ...counts })).toBe(
      cycles.httpOutcallV2(narrowed),
    );
  }

  // Leaving the committee unset is still the whole subnet requiring two thirds
  // of it, which is what the protocol defaults to.
  expect(
    cycles.httpOutcallV2({ ...USAGE, replication: Replication.Flexible }),
  ).toBe(
    cycles.httpOutcallV2({
      ...USAGE,
      replication: Replication.Flexible,
      totalRequests: 13,
      minResponses: 9, // floor(2 / 3 * 13) + 1
    }),
  );
});

it("should hold version 2 usage to what the protocol permits", () => {
  const cycles = calculators().calculatorCycles;

  // Nothing an outcall can consume exceeds these, so usage beyond them
  // describes a call that could not have happened and is priced as the
  // largest one that could.
  const capped = {
    ...USAGE,
    response: 2_000_000 as Bytes,
    delivered: 2_001_024 as Bytes,
    roundtrip: Duration.fromMillis(60_000),
    transformInstructions: 5_000_000_000 as Instructions,
  };
  expect(
    cycles.httpOutcallV2({
      ...USAGE,
      response: 9_999_999 as Bytes,
      delivered: 9_999_999 as Bytes,
      roundtrip: Duration.fromSeconds(600),
      transformInstructions: 50_000_000_000 as Instructions,
    }),
  ).toBe(cycles.httpOutcallV2(capped));

  // Which makes the payment for the maximum usage the largest there is.
  const max = maxHttpOutcallUsage({ request: 100 as Bytes });
  expect(cycles.httpOutcallV2Payment(capped)).toBe(
    cycles.httpOutcallV2Payment({ ...max, request: USAGE.request }),
  );
});

it("should price version 2 for a call the protocol could have accepted", () => {
  const cycles = calculators().calculatorCycles;

  // Bytes, milliseconds, instructions and nodes are whole numbers the protocol
  // counts in, and none of them can be negative, so usage that is neither is
  // priced as the call the protocol would have seen.
  expect(
    cycles.httpOutcallV2({
      ...USAGE,
      request: 100.9 as Bytes,
      response: 1_000.9 as Bytes,
      delivered: 2_000.9 as Bytes,
      transformInstructions: 26.9 as Instructions,
    }),
  ).toBe(cycles.httpOutcallV2(USAGE));

  expect(
    cycles.httpOutcallV2({
      ...USAGE,
      request: -100 as Bytes,
      response: -1_000 as Bytes,
      delivered: -2_000 as Bytes,
      roundtrip: Duration.fromMillis(-2_000),
      transformInstructions: -26 as Instructions,
    }),
  ).toBe(
    cycles.httpOutcallV2({
      ...USAGE,
      request: 0 as Bytes,
      response: 0 as Bytes,
      delivered: 0 as Bytes,
      roundtrip: Duration.fromMillis(0),
      transformInstructions: 0 as Instructions,
    }),
  );

  // A request is capped like a response is.
  expect(cycles.httpOutcallV2({ ...USAGE, request: 9_999_999 as Bytes })).toBe(
    cycles.httpOutcallV2({ ...USAGE, request: 2_000_000 as Bytes }),
  );

  // A committee cannot be larger than the subnet, nor smaller than one node.
  const flexible = { ...USAGE, replication: Replication.Flexible };
  expect(cycles.httpOutcallV2({ ...flexible, totalRequests: 99 })).toBe(
    cycles.httpOutcallV2({ ...flexible, totalRequests: 13 }),
  );
  expect(cycles.httpOutcallV2({ ...flexible, totalRequests: 0 })).toBe(
    cycles.httpOutcallV2({ ...flexible, totalRequests: 1 }),
  );
  expect(cycles.httpOutcallV2({ ...flexible, totalRequests: 3.9 })).toBe(
    cycles.httpOutcallV2({ ...flexible, totalRequests: 3 }),
  );
});

it("should price every millisecond of round trip", () => {
  const cycles = calculators().calculatorCycles;
  const at = (ms: number): number =>
    cycles.httpOutcallV2({ ...USAGE, roundtrip: Duration.fromMillis(ms) });

  // At 300 cycles per millisecond per node, on 13 of them.
  for (const ms of [1_001, 1_002, 1_003, 1_999, 2_001]) {
    expect(at(ms) - at(1_000)).toBe((ms - 1_000) * 3_900);
  }
});

it("should price version 2 on a subnet of whole nodes, at least one", () => {
  const on = (subnetSize: number): number =>
    calculators({ subnetSize }).calculatorCycles.httpOutcallV2(USAGE);

  // A subnet has a whole number of nodes and cannot have none, so a size that
  // is neither prices as the subnet the protocol could have had.
  expect(on(1)).toBeGreaterThan(0);
  for (const subnetSize of [0, 0.5, -5]) {
    expect(on(subnetSize)).toBe(on(1));
  }
  expect(on(13.9)).toBe(on(13));
});

it("should report a maximum usage the protocol would accept", () => {
  const cycles = calculators().calculatorCycles;

  // The helper describes the largest call there is, so asking it for one
  // larger than the protocol permits gives the largest one permitted.
  const beyond = maxHttpOutcallUsage({
    request: 9_999_999 as Bytes,
    maxResponseBytes: 9_999_999 as Bytes,
  });
  expect(beyond.request).toBe(2_000_000);
  expect(beyond.response).toBe(2_000_000);
  expect(beyond.delivered).toBe(2_001_024);
  expect(cycles.httpOutcallV2Payment(beyond)).toBe(
    cycles.httpOutcallV2Payment(
      maxHttpOutcallUsage({
        request: 2_000_000 as Bytes,
        maxResponseBytes: 2_000_000 as Bytes,
      }),
    ),
  );
});

it("should not carry a usage that is not a number into a price", () => {
  const cycles = calculators().calculatorCycles;
  const none = {
    request: 0 as Bytes,
    response: 0 as Bytes,
    delivered: 0 as Bytes,
    roundtrip: Duration.fromMillis(0),
    transformInstructions: 0 as Instructions,
  };

  expect(
    cycles.httpOutcallV2({
      request: NaN as Bytes,
      response: NaN as Bytes,
      delivered: NaN as Bytes,
      roundtrip: Duration.fromMillis(NaN),
      transformInstructions: NaN as Instructions,
    }),
  ).toBe(cycles.httpOutcallV2(none));

  // An infinity is a value on the range, so it clamps to the top of it.
  expect(
    cycles.httpOutcallV2({
      ...none,
      response: Infinity as Bytes,
      delivered: Infinity as Bytes,
      roundtrip: Duration.fromMillis(Infinity),
      transformInstructions: Infinity as Instructions,
    }),
  ).toBe(
    cycles.httpOutcallV2({
      ...none,
      response: 2_000_000 as Bytes,
      delivered: 2_001_024 as Bytes,
      roundtrip: Duration.fromMillis(60_000),
      transformInstructions: 5_000_000_000 as Instructions,
    }),
  );
});

it("should deliver what it downloaded when it says nothing else", () => {
  const cycles = calculators().calculatorCycles;

  // A response beyond the maximum is held to it, so a call that delivers what
  // it downloaded delivers that, not the maximum plus the bytes an encoding
  // could have added to a larger one.
  expect(
    cycles.httpOutcallV2({
      ...USAGE,
      response: 9_999_999 as Bytes,
      delivered: undefined,
    }),
  ).toBe(
    cycles.httpOutcallV2({
      ...USAGE,
      response: 2_000_000 as Bytes,
      delivered: 2_000_000 as Bytes,
    }),
  );

  // Saying so explicitly is a different claim: a transform may hand back more
  // than arrived, up to what an encoded response may carry.
  expect(
    cycles.httpOutcallV2({
      ...USAGE,
      response: 9_999_999 as Bytes,
      delivered: 9_999_999 as Bytes,
    }),
  ).toBe(
    cycles.httpOutcallV2({
      ...USAGE,
      response: 2_000_000 as Bytes,
      delivered: 2_001_024 as Bytes,
    }),
  );
});

it("should not charge version 2 for a flexible outcall that delivers nothing", () => {
  const cycles = calculators().calculatorCycles;
  // Delivering no response requires requiring none, so the base fee carries
  // neither of the terms that price the responses consensus has to agree on.
  const usage = {
    ...USAGE,
    replication: Replication.Flexible,
    totalRequests: 3,
    minResponses: 0,
    deliveredResponses: 0,
  };

  // Fire and forget: the nodes still perform the outcall and gossip, but no
  // response is put into a block.
  //   base fee = 13 * (1_000_000 + 50*100 + 90_000*13) = 28_275_000
  expect(cycles.httpOutcallV2(usage)).toBe(
    28_275_000 + 3 * (PER_NODE_USAGE_FEE + 50 * 2_000 * 13),
  );
  expect(cycles.httpOutcallV2Payment(usage)).toBe(cycles.httpOutcallV2(usage));
});

it("should bound the version 2 payment by the maximum usage", () => {
  const cycles = calculators().calculatorCycles;

  //   a 2 MB response, 60 s of round trip, and the full query instruction limit
  const max = maxHttpOutcallUsage({ request: 100 as Bytes });
  expect(max.response).toBe(2_000_000);
  expect(max.delivered).toBe(2_001_024);
  expect(max.roundtrip?.asMillis()).toBe(60_000);
  expect(max.transformInstructions).toBe(5_000_000_000);

  // Nothing an outcall that leaves `max_response_bytes` unset can consume costs
  // more than the payment computed from it.
  const payment = cycles.httpOutcallV2Payment(max);
  expect(cycles.httpOutcallV2(max)).toBeLessThan(payment);
  expect(cycles.httpOutcallV2Payment(USAGE)).toBeLessThan(payment);

  // Capping the response lowers the payment, which is the point of doing so.
  expect(
    cycles.httpOutcallV2Payment(
      maxHttpOutcallUsage({
        request: 100 as Bytes,
        maxResponseBytes: 10_000 as Bytes,
      }),
    ),
  ).toBeLessThan(payment);
});

it("should compute canister creation cost on a 13-node subnet", () => {
  const cycles = calculators().calculatorCycles;
  const $ = calculators().calculatorUSD;

  expect(cycles.canisterCreation()).toBeCloseTo(500_000_000_000);
  expect($.canisterCreation()).toBeCloseTo(0.662);
});

it("should compute canister creation cost on a 34-node subnet", () => {
  const cycles = calculators({ subnetSize: 34 }).calculatorCycles;
  const $ = calculators({ subnetSize: 34 }).calculatorUSD;

  expect(cycles.canisterCreation()).toBeCloseTo((500_000_000_000 * 34) / 13);
  expect($.canisterCreation()).toBeCloseTo((0.662 * 34) / 13);
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

it("should charge version 2 on a system subnet", () => {
  const cycles = calculators({
    subnetType: SubnetType.System,
  }).calculatorCycles;

  // Unlike the version 1 fees, the version 2 ones are not part of the subnet
  // config, so they are the same on a system subnet as on an application one.
  // Only a subnet on a free cost schedule pays nothing.
  expect(cycles.httpOutcall(USAGE.request, USAGE.response)).toBe(0);
  expect(cycles.httpOutcallV2(USAGE)).toBe(
    calculators().calculatorCycles.httpOutcallV2(USAGE),
  );
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
  expect(execute1b).toBeCloseTo(0.00133, 5);
  expect(send1mb).toBeCloseTo(0.00265, 5);
});

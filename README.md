# icp-calculator

This repository contains a utility library that implements a calculator of fees
and costs for smart contracts on the Internet Computer Protocol (ICP).

Currently it supports the following operations and resources:

- **storage**: the cost to store some number of bytes for some period of time.
- **message execution**: the cost to execute some number of instructions.
- **message sending**: the cost to send some number of bytes as a message.
- **HTTP outcalls**: the cost to make an HTTP outcall.
- **canister creation**: the cost to create a canister.

More will be added in the future.

## Installation

```bash
# with npm
npm install @dfinity/icp-calculator
# with pnpm
pnpm add @dfinity/icp-calculator
# with yarn
yarn add @dfinity/icp-calculator
```

## Usage

See `src/index.spec.ts` for more examples of usage.

```typescript
import {
  calculators,
  Direction,
  Duration,
  Mode,
} from "@dfinity/icp-calculator";
import type { Bytes, Instructions } from "@dfinity/icp-calculator";

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
```

## How it works

The main logic of the calculator is in `src/calculator.ts`.
The code there mirrors the replica code and it depends on the replica config, which is stored in `src/icp/config.json`.
The JSON config file is generated by the `icp_config` tool in the replica repository.

The JSON config file can be updated as follows:

```
# Check out `https://github.com/dfinity/ic` to `~/ic`
# Check out `https://github.com/dfinity/icp-calculator` to `~/icp-calculator`
cd ~/ic
bazel run //rs/execution_environment/tools:icp_config -- --replica-version=rc--2024-07-25_01-30 --output=~/icp-calculator/src/icp/config.json
```

## Documentation

`@dfinity/icp-calculator` exposes following types and functions:

<!-- TSDOC_START -->

### :toolbox: Functions

- [calculators](#gear-calculators)

#### :gear: calculators

The main export of the library. It returns cost calculators that operate in
cycles and USD based on the given options.

| Function      | Type                                              |
| ------------- | ------------------------------------------------- |
| `calculators` | `(options?: Options or undefined) => Calculators` |

Parameters:

- `options`: - optional options to configure the calculators.

[:link: Source](https://github.com/dfinity/icp-calculator/tree/main/src/index.ts#L64)

<!-- TSDOC_END -->

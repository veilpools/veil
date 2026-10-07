# Shield circuit artifacts

These files are the 0xbow Privacy Pools Core v1.2.1 commitment and withdrawal artifacts for the pinned upstream source commit `a80836a47451e662f127af17e11430ffa976c234`.

The `.zkey` and `.wasm` SHA-256 hashes match the upstream SDK v1.1.1 published integrity table. The verification-key JSON files and Solidity verifier sources were regenerated from those exact `.zkey` files with snarkjs 0.7.5 and match the same published integrity table. Run `npm run verify:shield-artifacts` to verify all six checksums, regenerate and compare both verification keys, and confirm the checked-in Solidity verifier source is reproducible. The app checks each downloaded artifact against the hashes pinned in `lib/shielded-artifact-integrity.ts` before using it. Run `npm run compile:privacy-pools` to compile the contracts with Solidity 0.8.28.

Upstream source and ceremony references:

- https://github.com/0xbow-io/privacy-pools-core/tree/v1.2.1
- https://www.npmjs.com/package/@0xbow/privacy-pools-core-sdk/v/1.1.1
- https://github.com/privacy-ethereum/perpetualpowersoftau
- https://l2beat.com/privacy/projects/privacy-pools

License: Apache-2.0. See the upstream repository's `LICENSE` file. The artifacts do not make this Artemis integration audited or production-ready by themselves.

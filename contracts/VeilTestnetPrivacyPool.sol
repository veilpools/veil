// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {PrivacyPoolSimple} from "vendor/0xbow-privacy-pools-core-v1.2.1/contracts-src/contracts/implementations/PrivacyPoolSimple.sol";

/// @notice Testnet deployment variant that cannot accept deposits until the guardian explicitly activates it.
/// @dev Keeps the pinned 0xbow withdrawal, verifier, and pool logic; only the initial pause state differs.
/// @dev Mirrors kentir contracts/ArtemisMainnetPrivacyPoolSimple.sol pattern for Robinhood TESTNET 46630 ONLY.
contract VeilTestnetPrivacyPool is PrivacyPoolSimple {
  bool public activationPending = true;

  error ActivationAlreadyCompleted();

  event DepositsActivated(address indexed guardian);

  constructor(address entrypoint, address withdrawalVerifier, address ragequitVerifier, address guardian)
    PrivacyPoolSimple(entrypoint, withdrawalVerifier, ragequitVerifier, guardian)
  {
    depositsPaused = true;
  }

  /// @notice Opens deposits once after the testnet deployment and configuration checks are complete.
  function activateDeposits() external {
    if (msg.sender != guardian) revert NotGuardian();
    if (!activationPending) revert ActivationAlreadyCompleted();

    activationPending = false;
    depositsPaused = false;
    emit DepositsActivated(msg.sender);
  }
}

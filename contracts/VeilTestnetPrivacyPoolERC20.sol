// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {PrivacyPoolComplex} from "vendor/0xbow-privacy-pools-core-v1.2.1/contracts-src/contracts/implementations/PrivacyPoolComplex.sol";

/// @notice Testnet ERC20 0xbow pool variant (e.g. VEIL). Guardian-gated activation.
/// @dev Testnet 46630 ONLY.
contract VeilTestnetPrivacyPoolERC20 is PrivacyPoolComplex {
  bool public activationPending = true;

  error ActivationAlreadyCompleted();

  event DepositsActivated(address indexed guardian);

  constructor(address entrypoint, address withdrawalVerifier, address ragequitVerifier, address asset, address poolGuardian)
    PrivacyPoolComplex(entrypoint, withdrawalVerifier, ragequitVerifier, asset)
  {
    require(poolGuardian != address(0), "zero guardian");
    guardian = poolGuardian;
    depositsPaused = true;
  }

  /// @notice Opens deposits once after the testnet deployment checks complete.
  function activateDeposits() external {
    if (msg.sender != guardian) revert NotGuardian();
    if (!activationPending) revert ActivationAlreadyCompleted();

    activationPending = false;
    depositsPaused = false;
    emit DepositsActivated(msg.sender);
  }
}

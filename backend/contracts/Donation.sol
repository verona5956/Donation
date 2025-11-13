// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint64, externalEuint64 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Donation — Privacy-preserving donation platform using Zama FHEVM
/// @notice Stores donation amounts as encrypted values and performs encrypted aggregation on-chain
contract Donation is ZamaEthereumConfig {
    struct Project {
        address owner;
        string name;
        euint64 total;
        bool exists;
    }

    uint256 private _projectIdCounter;
    mapping(uint256 => Project) private _projects;
    mapping(uint256 => mapping(address => euint64)) private _donations; // projectId => donor => enc amount

    event ProjectCreated(uint256 indexed projectId, address indexed owner, string name);
    event Donated(uint256 indexed projectId, address indexed donor);

    /// @notice Create a new donation project
    /// @param name Project name
    /// @return projectId Newly created project id
    /// @dev Increments project counter and initializes project with encrypted zero total
    function createProject(string calldata name) external returns (uint256 projectId) {
        require(bytes(name).length > 0, "NAME_REQUIRED");
        projectId = ++_projectIdCounter;
        Project storage p = _projects[projectId];
        p.owner = msg.sender;
        p.name = name;
        p.exists = true;
        // p.total defaults to 0 (encrypted zero)
        emit ProjectCreated(projectId, msg.sender, name);
    }

    /// @notice Donate to a project with an encrypted amount
    /// @param projectId Target project id
    /// @param inputAmount Encrypted amount handle created off-chain
    /// @param inputProof Zero-knowledge proof produced by the SDK/Relayer
    function donate(
        uint256 projectId,
        externalEuint64 inputAmount,
        bytes calldata inputProof
    ) external {
        Project storage p = _projects[projectId];
        require(p.exists, "PROJECT_NOT_FOUND");

        // convert external encrypted input to internal encrypted value
        euint64 encAmount = FHE.fromExternal(inputAmount, inputProof);

        // update project total (encrypted sum)
        p.total = FHE.add(p.total, encAmount);

        // set ACL so contract and relevant users can decrypt via relayer/userDecrypt
        FHE.allowThis(p.total);
        FHE.allow(p.total, msg.sender); // donor can decrypt total if desired
        FHE.allow(p.total, p.owner);    // project owner can decrypt aggregated total

        // update donor's cumulative donation for this project
        euint64 updated = FHE.add(_donations[projectId][msg.sender], encAmount);
        _donations[projectId][msg.sender] = updated;

        FHE.allowThis(updated);
        FHE.allow(updated, msg.sender); // donor can decrypt own donation

        emit Donated(projectId, msg.sender);
    }

    /// @notice Get project basic info (name, owner)
    function getProjectInfo(uint256 projectId) external view returns (string memory name, address owner) {
        Project storage p = _projects[projectId];
        require(p.exists, "PROJECT_NOT_FOUND");
        return (p.name, p.owner);
    }

    /// @notice Returns encrypted total amount of a project
    function getProjectTotal(uint256 projectId) external view returns (euint64) {
        Project storage p = _projects[projectId];
        require(p.exists, "PROJECT_NOT_FOUND");
        return p.total;
    }

    /// @notice Returns caller's encrypted cumulative donations to a project
    function getMyDonation(uint256 projectId) external view returns (euint64) {
        Project storage p = _projects[projectId];
        require(p.exists, "PROJECT_NOT_FOUND");
        return _donations[projectId][msg.sender];
    }

    /// @notice Returns someone else's encrypted cumulative donation (still encrypted)
    function getDonationOf(uint256 projectId, address donor) external view returns (euint64) {
        Project storage p = _projects[projectId];
        require(p.exists, "PROJECT_NOT_FOUND");
        return _donations[projectId][donor];
    }

    /// @notice Returns number of projects
    function getProjectCount() external view returns (uint256) {
        return _projectIdCounter;
    }
}



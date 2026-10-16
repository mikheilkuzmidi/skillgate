// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract SkillGate is Ownable {
    struct CertificateType {
        string name;
        uint256 validityPeriod;
        bytes32 role;
        address issuer;
        bool active;
        bytes32 quizHash;
    }

    struct Certificate {
        uint256 typeId;
        address holder;
        uint256 issuedAt;
        uint256 expiresAt;
        bool revoked;
    }

    struct Task {
        string name;
        uint256 requiredTypeId;
        bool active;
    }

    struct IssuedCertificateRef {
        address holder;
        uint256 typeId;
    }

    mapping(uint256 => CertificateType) public certificateTypes;
    mapping(address => mapping(uint256 => Certificate)) public certificates;
    mapping(uint256 => Task) public tasks;
    mapping(address => bool) public isEmployee;
    mapping(address => bytes32) public employeeRole;
    mapping(address => bool) public isIssuer;

    uint256 public certificateTypeCount;
    uint256 public taskCount;

    address[] private employees;
    IssuedCertificateRef[] private issuedCertificates;
    mapping(address => mapping(uint256 => uint256)) private issuedIndexPlusOne;

    error NotAdmin(address caller);
    error NotIssuer(address caller);
    error ZeroAddress();
    error EmptyName();
    error EmptyRole();
    error InvalidValidityPeriod();
    error InvalidCertificateType(uint256 typeId);
    error InvalidTask(uint256 taskId);
    error NotEmployee(address worker);
    error RoleMismatch(address worker, bytes32 workerRole, bytes32 credentialRole);
    error CertificateMissing(address holder, uint256 typeId);
    error GateFailed(address employee, uint256 taskId);
    error QuizFailed(address worker, uint256 typeId);
    error ClaimRevoked(address worker, uint256 typeId);

    event EmployeeRegistered(address indexed worker, bytes32 indexed role);
    event IssuerAuthorized(address indexed issuer);
    event CertificateTypeCreated(uint256 indexed typeId, string name, uint256 validityPeriod);
    event CertificateIssued(address indexed holder, uint256 indexed typeId, uint256 expiresAt);
    event CertificateRevoked(address indexed holder, uint256 indexed typeId);
    event TaskCreated(uint256 indexed taskId, string name, uint256 requiredTypeId);
    event TaskStarted(address indexed employee, uint256 indexed taskId);

    modifier onlyAdmin() {
        if (msg.sender != owner()) {
            revert NotAdmin(msg.sender);
        }
        _;
    }

    modifier onlyIssuer() {
        if (!isIssuer[msg.sender]) {
            revert NotIssuer(msg.sender);
        }
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) {
            revert ZeroAddress();
        }
        isIssuer[initialOwner] = true;
        emit IssuerAuthorized(initialOwner);
    }

    function registerEmployee(address worker, bytes32 role) external onlyAdmin {
        if (worker == address(0)) {
            revert ZeroAddress();
        }
        if (role == bytes32(0)) {
            revert EmptyRole();
        }
        if (!isEmployee[worker]) {
            employees.push(worker);
        }
        isEmployee[worker] = true;
        employeeRole[worker] = role;
        emit EmployeeRegistered(worker, role);
    }

    function authorizeIssuer(address issuer) external onlyAdmin {
        if (issuer == address(0)) {
            revert ZeroAddress();
        }
        isIssuer[issuer] = true;
        emit IssuerAuthorized(issuer);
    }

    function createCertificateType(
        string calldata name,
        uint256 validityPeriod,
        bytes32 role,
        bytes32 quizHash
    ) external onlyAdmin returns (uint256 typeId) {
        if (bytes(name).length == 0) {
            revert EmptyName();
        }
        if (validityPeriod == 0) {
            revert InvalidValidityPeriod();
        }
        if (role == bytes32(0)) {
            revert EmptyRole();
        }

        typeId = ++certificateTypeCount;
        certificateTypes[typeId] = CertificateType({
            name: name,
            validityPeriod: validityPeriod,
            role: role,
            issuer: msg.sender,
            active: true,
            quizHash: quizHash
        });

        emit CertificateTypeCreated(typeId, name, validityPeriod);
    }

    function createTask(string calldata name, uint256 requiredTypeId) external onlyAdmin returns (uint256 taskId) {
        if (bytes(name).length == 0) {
            revert EmptyName();
        }
        _requireActiveCertificateType(requiredTypeId);

        taskId = ++taskCount;
        tasks[taskId] = Task({name: name, requiredTypeId: requiredTypeId, active: true});
        emit TaskCreated(taskId, name, requiredTypeId);
    }

    function issueCertificate(address holder, uint256 typeId) external onlyIssuer {
        if (!isEmployee[holder]) {
            revert NotEmployee(holder);
        }

        CertificateType memory certType = _requireActiveCertificateType(typeId);
        bytes32 holderRole = employeeRole[holder];
        if (holderRole != certType.role) {
            revert RoleMismatch(holder, holderRole, certType.role);
        }

        _issue(holder, typeId, certType);
    }

    /// @notice A registered worker certifies themselves by passing the credential's quiz.
    /// The answer is verified on-chain against the stored quiz hash. The worker sends and
    /// pays for this transaction, so issuance needs no trusted server key.
    function claimCertificate(uint256 typeId, string calldata answer) external {
        address worker = msg.sender;
        if (!isEmployee[worker]) {
            revert NotEmployee(worker);
        }

        CertificateType memory certType = _requireActiveCertificateType(typeId);
        bytes32 workerRole = employeeRole[worker];
        if (workerRole != certType.role) {
            revert RoleMismatch(worker, workerRole, certType.role);
        }

        // Revocation is an issuer decision. A public quiz answer must not undo it.
        if (certificates[worker][typeId].revoked) {
            revert ClaimRevoked(worker, typeId);
        }

        if (certType.quizHash != bytes32(0) && keccak256(bytes(answer)) != certType.quizHash) {
            revert QuizFailed(worker, typeId);
        }

        _issue(worker, typeId, certType);
    }

    function _issue(address holder, uint256 typeId, CertificateType memory certType) private {
        uint256 expiresAt = block.timestamp + certType.validityPeriod;
        certificates[holder][typeId] = Certificate({
            typeId: typeId,
            holder: holder,
            issuedAt: block.timestamp,
            expiresAt: expiresAt,
            revoked: false
        });

        if (issuedIndexPlusOne[holder][typeId] == 0) {
            issuedCertificates.push(IssuedCertificateRef({holder: holder, typeId: typeId}));
            issuedIndexPlusOne[holder][typeId] = issuedCertificates.length;
        }

        emit CertificateIssued(holder, typeId, expiresAt);
    }

    function revokeCertificate(address holder, uint256 typeId) external {
        if (msg.sender != owner() && !isIssuer[msg.sender]) {
            revert NotIssuer(msg.sender);
        }
        Certificate storage cert = certificates[holder][typeId];
        if (cert.issuedAt == 0) {
            revert CertificateMissing(holder, typeId);
        }
        cert.revoked = true;
        emit CertificateRevoked(holder, typeId);
    }

    function hasValidCertificate(address holder, uint256 typeId) public view returns (bool) {
        Certificate memory cert = certificates[holder][typeId];
        CertificateType memory certType = certificateTypes[typeId];
        return isEmployee[holder] && certType.active && employeeRole[holder] == certType.role
            && cert.issuedAt != 0 && !cert.revoked && block.timestamp < cert.expiresAt;
    }

    function canStartTask(address employee, uint256 taskId) public view returns (bool) {
        Task memory task = tasks[taskId];
        return task.active && isEmployee[employee] && hasValidCertificate(employee, task.requiredTypeId);
    }

    function startTask(uint256 taskId) external {
        Task memory task = tasks[taskId];
        if (!task.active) {
            revert InvalidTask(taskId);
        }
        if (!canStartTask(msg.sender, taskId)) {
            revert GateFailed(msg.sender, taskId);
        }
        emit TaskStarted(msg.sender, taskId);
    }

    function getEmployees() external view returns (address[] memory) {
        return employees;
    }

    function getIssuedCertificateRefs() external view returns (IssuedCertificateRef[] memory) {
        return issuedCertificates;
    }

    function getCertificateStatus(address holder, uint256 typeId)
        external
        view
        returns (bool exists, bool valid, bool expired, bool revoked)
    {
        Certificate memory cert = certificates[holder][typeId];
        exists = cert.issuedAt != 0;
        revoked = cert.revoked;
        expired = exists && block.timestamp >= cert.expiresAt;
        valid = hasValidCertificate(holder, typeId);
    }

    function _requireActiveCertificateType(uint256 typeId) private view returns (CertificateType memory certType) {
        certType = certificateTypes[typeId];
        if (!certType.active) {
            revert InvalidCertificateType(typeId);
        }
    }
}

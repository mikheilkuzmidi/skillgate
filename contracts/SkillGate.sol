// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title SkillGate
/// @notice Role-scoped workforce certificates that gate work. An admin registers workers and
/// defines certificate types and tasks; workers earn a certificate by passing its quiz or from an
/// issuer; a task can start only while the worker holds a valid certificate for it.
/// @dev Certificates are contract state, not tokens: they cannot be transferred.
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
    event IssuerRevoked(address indexed issuer);
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

    /// @notice Registers a worker, or changes their role. A role change invalidates certificates for the old role.
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

    /// @notice Allows an address to issue and revoke certificates.
    function authorizeIssuer(address issuer) external onlyAdmin {
        if (issuer == address(0)) {
            revert ZeroAddress();
        }
        isIssuer[issuer] = true;
        emit IssuerAuthorized(issuer);
    }

    /// @notice Removes an issuer. Certificates it already issued stay as they are.
    function revokeIssuer(address issuer) external onlyAdmin {
        if (issuer == address(0)) {
            revert ZeroAddress();
        }
        isIssuer[issuer] = false;
        emit IssuerRevoked(issuer);
    }

    /// @notice Defines a certificate for one role. A non-zero quiz hash lets workers self-claim with the answer.
    /// @return typeId The new certificate type's id, starting at 1.
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

    /// @notice Creates a task that requires a valid certificate of `requiredTypeId` to start.
    /// @return taskId The new task's id, starting at 1.
    function createTask(string calldata name, uint256 requiredTypeId) external onlyAdmin returns (uint256 taskId) {
        if (bytes(name).length == 0) {
            revert EmptyName();
        }
        _requireActiveCertificateType(requiredTypeId);

        taskId = ++taskCount;
        tasks[taskId] = Task({name: name, requiredTypeId: requiredTypeId, active: true});
        emit TaskCreated(taskId, name, requiredTypeId);
    }

    /// @notice Issues (or renews) a certificate to a registered worker whose role matches the type.
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

    /// @notice Revokes a worker's certificate. Only the admin or an issuer can revoke.
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

    /// @notice True while the holder is registered in the type's role and the certificate is issued, unrevoked and unexpired.
    function hasValidCertificate(address holder, uint256 typeId) public view returns (bool) {
        Certificate memory cert = certificates[holder][typeId];
        CertificateType memory certType = certificateTypes[typeId];
        return isEmployee[holder] && certType.active && employeeRole[holder] == certType.role
            && cert.issuedAt != 0 && !cert.revoked && block.timestamp < cert.expiresAt;
    }

    /// @notice True when the task is active and the employee holds a valid certificate for it.
    function canStartTask(address employee, uint256 taskId) public view returns (bool) {
        Task memory task = tasks[taskId];
        return task.active && isEmployee[employee] && hasValidCertificate(employee, task.requiredTypeId);
    }

    /// @notice Starts a task. The certificate check runs on every start.
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

    /// @notice All registered worker addresses.
    function getEmployees() external view returns (address[] memory) {
        return employees;
    }

    /// @notice Every (holder, type) pair that has ever been issued, for listing certificates.
    function getIssuedCertificateRefs() external view returns (IssuedCertificateRef[] memory) {
        return issuedCertificates;
    }

    /// @notice Status flags for one holder and certificate type.
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

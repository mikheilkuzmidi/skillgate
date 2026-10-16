import assert from "node:assert/strict";
import { describe, it } from "node:test";
import hre from "hardhat";
import { keccak256, toBytes } from "viem";
import { QUIZZES, answerKey, quizHashForId } from "../lib/quizzes";

const DAY = 24n * 60n * 60n;
const OPERATOR_ROLE = keccak256(toBytes("Silo forklift operator"));
const ENGINEER_ROLE = keccak256(toBytes("Blockchain engineer"));

async function deployFixture() {
  const { viem, networkHelpers } = await hre.network.create();
  const [owner, issuer, operator, engineer, outsider] = await viem.getWalletClients();
  const contract = await viem.deployContract("SkillGate", [owner.account.address]);

  await contract.write.authorizeIssuer([issuer.account.address]);
  await contract.write.registerEmployee([operator.account.address, OPERATOR_ROLE]);
  await contract.write.registerEmployee([engineer.account.address, ENGINEER_ROLE]);
  await contract.write.createCertificateType(["Forklift Safety L2", 365n * DAY, OPERATOR_ROLE, quizHashForId("1")]);
  await contract.write.createCertificateType(["Solidity and Ethereum", 180n * DAY, ENGINEER_ROLE, quizHashForId("2")]);
  await contract.write.createTask(["Operate silo forklift", 1n]);
  await contract.write.createTask(["Ship crypto payroll bridge", 2n]);

  return { contract, networkHelpers, owner, issuer, operator, engineer, outsider };
}

async function assertRejectsWith(promise: Promise<unknown>, message: string) {
  await assert.rejects(promise, (error) => {
    assert.match(String(error), new RegExp(message));
    return true;
  });
}

describe("SkillGate", function () {
  it("allows only an authorized issuer to issue certificates", async function () {
    const { contract, operator, outsider } = await deployFixture();

    await assertRejectsWith(
      contract.write.issueCertificate([operator.account.address, 1n], {
        account: outsider.account
      }),
      "NotIssuer"
    );
  });

  it("reverts when issuing a credential outside the worker role", async function () {
    const { contract, issuer, operator } = await deployFixture();

    await assertRejectsWith(
      contract.write.issueCertificate([operator.account.address, 2n], {
        account: issuer.account
      }),
      "RoleMismatch"
    );
  });

  it("fails the gate for expired certificates", async function () {
    const { contract, networkHelpers, issuer, engineer } = await deployFixture();

    await contract.write.issueCertificate([engineer.account.address, 2n], {
      account: issuer.account
    });
    assert.equal(await contract.read.canStartTask([engineer.account.address, 2n]), true);

    await networkHelpers.time.increase(181n * DAY);
    assert.equal(await contract.read.canStartTask([engineer.account.address, 2n]), false);
    await assertRejectsWith(
      contract.write.startTask([2n], {
        account: engineer.account
      }),
      "GateFailed"
    );
  });

  it("fails the gate for revoked certificates", async function () {
    const { contract, issuer, engineer } = await deployFixture();

    await contract.write.issueCertificate([engineer.account.address, 2n], {
      account: issuer.account
    });
    await contract.write.revokeCertificate([engineer.account.address, 2n]);

    assert.equal(await contract.read.canStartTask([engineer.account.address, 2n]), false);
    await assertRejectsWith(
      contract.write.startTask([2n], {
        account: engineer.account
      }),
      "GateFailed"
    );
  });

  it("fails the gate for non-registered wallets", async function () {
    const { contract, outsider } = await deployFixture();

    assert.equal(await contract.read.canStartTask([outsider.account.address, 1n]), false);
    await assertRejectsWith(
      contract.write.startTask([1n], {
        account: outsider.account
      }),
      "GateFailed"
    );
  });

  it("passes the full happy path", async function () {
    const { contract, issuer, engineer } = await deployFixture();

    assert.equal(await contract.read.canStartTask([engineer.account.address, 2n]), false);
    await contract.write.issueCertificate([engineer.account.address, 2n], {
      account: issuer.account
    });
    assert.equal(await contract.read.canStartTask([engineer.account.address, 2n]), true);

    await contract.write.startTask([2n], {
      account: engineer.account
    });
  });

  it("lets a worker self-claim by passing the on-chain quiz", async function () {
    const { contract, engineer } = await deployFixture();

    assert.equal(await contract.read.hasValidCertificate([engineer.account.address, 2n]), false);
    await contract.write.claimCertificate([2n, answerKey(QUIZZES["2"])], {
      account: engineer.account
    });
    assert.equal(await contract.read.hasValidCertificate([engineer.account.address, 2n]), true);
    assert.equal(await contract.read.canStartTask([engineer.account.address, 2n]), true);
  });

  it("rejects a self-claim with a wrong quiz answer", async function () {
    const { contract, engineer } = await deployFixture();

    await assertRejectsWith(
      contract.write.claimCertificate([2n, "9-9-9"], {
        account: engineer.account
      }),
      "QuizFailed"
    );
    assert.equal(await contract.read.hasValidCertificate([engineer.account.address, 2n]), false);
  });

  it("rejects a self-claim for a credential outside the worker role", async function () {
    const { contract, operator } = await deployFixture();

    await assertRejectsWith(
      contract.write.claimCertificate([2n, answerKey(QUIZZES["2"])], {
        account: operator.account
      }),
      "RoleMismatch"
    );
  });

  it("rejects a self-claim from an unregistered wallet", async function () {
    const { contract, outsider } = await deployFixture();

    await assertRejectsWith(
      contract.write.claimCertificate([1n, answerKey(QUIZZES["1"])], {
        account: outsider.account
      }),
      "NotEmployee"
    );
  });

  it("keeps revocation in force even when the worker knows the quiz answer", async function () {
    const { contract, engineer } = await deployFixture();
    await contract.write.claimCertificate([2n, answerKey(QUIZZES["2"])], { account: engineer.account });
    await contract.write.revokeCertificate([engineer.account.address, 2n]);
    await assertRejectsWith(
      contract.write.claimCertificate([2n, answerKey(QUIZZES["2"])], { account: engineer.account }),
      "ClaimRevoked"
    );
    assert.equal(await contract.read.canStartTask([engineer.account.address, 2n]), false);
    // An issuer can deliberately restore access without duplicating the public index.
    await contract.write.issueCertificate([engineer.account.address, 2n]);
    assert.equal(await contract.read.canStartTask([engineer.account.address, 2n]), true);
    assert.equal((await contract.read.getIssuedCertificateRefs()).length, 1);
  });

  it("removes old-role access immediately after the admin changes a worker's role", async function () {
    const { contract, engineer } = await deployFixture();
    await contract.write.issueCertificate([engineer.account.address, 2n]);
    await contract.write.registerEmployee([engineer.account.address, OPERATOR_ROLE]);
    assert.equal(await contract.read.hasValidCertificate([engineer.account.address, 2n]), false);
    assert.equal((await contract.read.getCertificateStatus([engineer.account.address, 2n]))[1], false);
    await assertRejectsWith(contract.write.startTask([2n], { account: engineer.account }), "GateFailed");
    assert.equal((await contract.read.getEmployees()).length, 2);
  });

  it("expires at the exact boundary and can renew an expired credential", async function () {
    const { contract, engineer, networkHelpers } = await deployFixture();
    await contract.write.issueCertificate([engineer.account.address, 2n]);
    const certificate = await contract.read.certificates([engineer.account.address, 2n]);
    await networkHelpers.time.increaseTo(certificate[3]);
    assert.deepEqual(await contract.read.getCertificateStatus([engineer.account.address, 2n]), [true, false, true, false]);
    await contract.write.claimCertificate([2n, answerKey(QUIZZES["2"])], { account: engineer.account });
    assert.equal(await contract.read.canStartTask([engineer.account.address, 2n]), true);
  });
});

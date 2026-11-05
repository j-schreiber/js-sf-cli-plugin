import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { Connection, Org } from '@salesforce/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { ComponentSet, MetadataApiDeploy } from '@salesforce/source-deploy-retrieve';
import { GarbageDisposer } from '../../src/garbage-disposal/index.js';
import type { GarbageDisposerEvents } from '../../src/garbage-disposal/types.js';
import type { PackageGarbageResult } from '../../src/garbage-collection/types.js';

const GARBAGE: PackageGarbageResult = {
  deprecatedMembers: {
    ExternalString: {
      metadataType: 'CustomLabel',
      componentCount: 2,
      components: [
        {
          developerName: 'Label_1',
          fullyQualifiedName: 'Label_1',
          subjectId: '1010X000009T4prQAC',
          subscriberPackageId: '0330X0000000000AAA',
        },
        {
          developerName: 'Label_2',
          fullyQualifiedName: 'Label_2',
          subjectId: '1010X000009T4pqQAC',
          subscriberPackageId: '0330X0000000000AAA',
        },
      ],
    },
  },
  unsupported: [],
  totalDeprecatedComponentCount: 2,
};

describe('garbage disposer', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  let connection: Connection;

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    connection = (await Org.create({ aliasOrUsername: testOrg.username })).getConnection();
  });

  afterEach(() => {
    $$.restore();
  });

  /**
   * Each call to `ComponentSet.deploy` (validation or deploy) returns the next response.
   */
  function stubDeploys(...responses: Array<Record<string, unknown>>): sinon.SinonStub {
    let call = 0;
    return $$.SANDBOX.stub(ComponentSet.prototype, 'deploy').callsFake(() => {
      const response = { id: '0Af000000000001', ...responses[call++] };
      return Promise.resolve({
        id: response.id,
        onUpdate: (cb: (status: Record<string, unknown>) => void) =>
          cb({ status: 'InProgress', numberComponentsDeployed: 1, numberComponentsTotal: 2 }),
        pollStatus: () => Promise.resolve({ response }),
      } as unknown as MetadataApiDeploy);
    });
  }

  it('creates package manifest from garbage', () => {
    // Act
    const manifest = GarbageDisposer.newInstance(connection).manifestFrom(GARBAGE);

    // Assert
    expect(manifest.toXML()).to.include('<name>CustomLabel</name>');
    expect(manifest.toXML()).to.include('<members>Label_1</members>');
    expect(manifest.toXML()).to.include('<members>Label_2</members>');
  });

  it('skips empty garbage without calling the org', async () => {
    // Arrange
    const deployStub = $$.SANDBOX.stub(ComponentSet.prototype, 'deploy');

    // Act
    const result = await GarbageDisposer.newInstance(connection).dispose({
      deprecatedMembers: {},
      unsupported: [],
      totalDeprecatedComponentCount: 0,
    });

    // Assert
    expect(deployStub.called).to.be.false;
    expect(result.status).to.equal('Skipped');
    expect(result.failed).to.deep.equal([]);
  });

  it('does not modify the input garbage', async () => {
    // Arrange
    const input = structuredClone(GARBAGE);
    input.deprecatedMembers.ExternalString.metadataType = 'NotARealType';

    // Act
    const result = await GarbageDisposer.newInstance(connection).dispose(input);

    // Assert
    expect(input.deprecatedMembers.ExternalString).to.not.be.undefined;
    expect(input.unsupported).to.deep.equal([]);
    expect(result.deprecatedMembers.ExternalString).to.be.undefined;
    expect(result.unsupported.length).to.equal(1);
  });

  it('emits typed events for validation and deploy', async () => {
    // Arrange
    stubDeploys({ success: true, details: {} }, { success: true, details: {} });
    const disposer = GarbageDisposer.newInstance(connection);
    const events: Array<{ name: keyof GarbageDisposerEvents; payload: unknown }> = [];
    disposer.on('validationRound', (payload) => events.push({ name: 'validationRound', payload }));
    disposer.on('deployStarted', (payload) => events.push({ name: 'deployStarted', payload }));
    disposer.on('deployProgress', (payload) => events.push({ name: 'deployProgress', payload }));

    // Act
    const result = await disposer.dispose(GARBAGE);

    // Assert
    expect(result.status).to.equal('Success');
    expect(events).to.deep.equal([
      { name: 'validationRound', payload: { round: 1, componentCount: 2 } },
      { name: 'deployStarted', payload: { deployId: '0Af000000000001' } },
      { name: 'deployProgress', payload: { status: 'InProgress', componentsDeployed: 1, componentsTotal: 2 } },
    ]);
  });

  it('stops validating after max validation rounds', async () => {
    // Arrange
    const deploys = stubDeploys({
      success: false,
      details: { componentFailures: { componentType: 'CustomLabel', fullName: 'Label_2', problem: 'In use' } },
    });

    // Act
    const result = await GarbageDisposer.newInstance(connection).dispose(GARBAGE, { maxValidationRounds: 1 });

    // Assert
    expect(deploys.callCount).to.equal(1);
    expect(result.status).to.equal('Failed');
    expect(result.failed.map((f) => [f.fullName, f.problem])).to.deep.equal([
      ['Label_2', 'In use'],
      ['Label_1', 'Validation did not succeed after 1 rounds.'],
    ]);
  });

  it('rejects invalid max validation rounds', async () => {
    // Act & Assert
    for (const maxValidationRounds of [0, -1, 1.5]) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await GarbageDisposer.newInstance(connection).dispose(GARBAGE, { maxValidationRounds });
        expect.fail(`Expected error for ${maxValidationRounds}`);
      } catch (err) {
        expect((err as Error).message).to.include('must be a positive integer');
      }
    }
  });
});

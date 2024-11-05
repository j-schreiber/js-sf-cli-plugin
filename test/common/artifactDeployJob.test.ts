import { expect } from 'chai';
import ArtifactDeployJob from '../../src/release-manifest/artifact-deploy-strategies/artifactDeployJob.js';
import { newOrgManifest } from '../mock-utils/releaseManifestMockUtils.js';
import { ArtifactTypes, DeployStatus } from '../../src/types/orgManifestGlobalConstants.js';
import UnpackagedDeployStep from '../../src/release-manifest/artifact-deploy-strategies/unpackagedDeployStep.js';

describe('deploy job', () => {
  it('has only pending steps > aggregate status is pending', () => {
    // Arrange
    const mockManifest = newOrgManifest();
    const deployJob = new ArtifactDeployJob(
      'my_happy_soup',
      { type: 'Unpackaged', path: 'test/data/mock-src/unpackaged/my-happy-soup' },
      mockManifest
    );

    // Assert
    expect(deployJob.getAggregatedStatus()).to.equal(DeployStatus.Enum.Pending);
  });

  it('has only skipped steps > aggregate status is skipped', () => {
    // Arrange
    const mockManifest = newOrgManifest();
    const deployJob = new ArtifactDeployJob(
      'my_happy_soup',
      { type: 'Unpackaged', path: 'test/data/mock-src/unpackaged/my-happy-soup' },
      mockManifest
    );

    // Act
    deployJob.getSteps().forEach((jobStep) => {
      const stepStatus = jobStep.getStatus();
      stepStatus.status = DeployStatus.Enum.Skipped;
    });

    // Assert
    expect(deployJob.getAggregatedStatus()).to.equal(DeployStatus.Enum.Skipped);
  });

  it('has only resolved steps > aggregate status is resolved', () => {
    // Arrange
    const mockManifest = newOrgManifest();
    const deployJob = new ArtifactDeployJob(
      'my_happy_soup',
      { type: ArtifactTypes.Enum.Unpackaged, path: 'test/data/mock-src/unpackaged/my-happy-soup' },
      mockManifest
    );

    // Act
    deployJob.getSteps().forEach((jobStep) => {
      const stepStatus = jobStep.getStatus();
      stepStatus.status = DeployStatus.Enum.Resolved;
    });

    // Assert
    expect(deployJob.getAggregatedStatus()).to.equal(DeployStatus.Enum.Resolved);
  });

  it('has skipped and one success step > aggregate status is success', () => {
    // Arrange
    const mockManifest = newOrgManifest();
    const artifactDef = { type: ArtifactTypes.Enum.Unpackaged, path: 'test/data/mock-src/unpackaged/my-happy-soup' };
    const deployJob = new ArtifactDeployJob('my_happy_soup', artifactDef, mockManifest);
    const secondDeployStep = new UnpackagedDeployStep(artifactDef, mockManifest);
    deployJob.getSteps().push(secondDeployStep);

    // Act
    deployJob.getSteps().forEach((jobStep) => {
      const stepStatus = jobStep.getStatus();
      stepStatus.status = DeployStatus.Enum.Skipped;
    });
    deployJob.getSteps()[deployJob.getSteps().length - 1].getStatus().status = DeployStatus.Enum.Success;

    // Assert
    expect(deployJob.getAggregatedStatus()).to.equal(DeployStatus.Enum.Success);
  });

  it('has success and one failed step > aggregate status is failed', () => {
    // Arrange
    const mockManifest = newOrgManifest();
    const artifactDef = { type: ArtifactTypes.Enum.Unpackaged, path: 'test/data/mock-src/unpackaged/my-happy-soup' };
    const deployJob = new ArtifactDeployJob('my_happy_soup', artifactDef, mockManifest);
    const secondDeployStep = new UnpackagedDeployStep(artifactDef, mockManifest);
    deployJob.getSteps().push(secondDeployStep);

    // Act
    deployJob.getSteps().forEach((jobStep) => {
      const stepStatus = jobStep.getStatus();
      stepStatus.status = DeployStatus.Enum.Success;
    });
    deployJob.getSteps()[0].getStatus().status = DeployStatus.Enum.Failed;

    // Assert
    expect(deployJob.getAggregatedStatus()).to.equal(DeployStatus.Enum.Failed);
  });
});

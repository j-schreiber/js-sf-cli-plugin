import { expect } from 'chai';
import ArtifactDeploySfCommand from '../../src/release-manifest/artifactDeploySfCommand.js';

describe('artifact deploy command builder', () => {
  describe('initialisation', () => {
    it('prepares command from constructor input', () => {
      // Act
      const sfCmd = new ArtifactDeploySfCommand('package:install', [
        { name: 'wait', value: '10' },
        { name: 'upgrade-type', value: 'Mixed' },
        { name: 'json' },
      ]);

      // Assert
      expect(Array.from(sfCmd.commandFlags.keys())).to.deep.equal(['wait', 'upgrade-type', 'json']);
      expect(sfCmd.commandFlags.get('upgrade-type')).to.equal('Mixed');
      expect(sfCmd.commandFlags.get('wait')).to.equal('10');
      expect(sfCmd.commandFlags.get('json')).to.be.undefined;
      expect(sfCmd.buildConfig()).to.deep.equal({
        name: 'package:install',
        args: ['--wait', '10', '--upgrade-type', 'Mixed', '--json'],
      });
    });
  });

  describe('flag parsing', () => {
    it('parses syntactically correct key-value flags successfully', () => {
      // Act
      const sfCmd = new ArtifactDeploySfCommand('package:install');
      sfCmd.parseFlags('upgrade-type=DeprecateOnly wait=20 apex-compile=package');

      // Assert
      const expectedKeys = ['upgrade-type', 'wait', 'apex-compile'];
      expect(Array.from(sfCmd.commandFlags.keys())).to.deep.equal(expectedKeys);
      expect(sfCmd.commandFlags.get('upgrade-type')).to.equal('DeprecateOnly');
      expect(sfCmd.commandFlags.get('wait')).to.equal('20');
      expect(sfCmd.commandFlags.get('apex-compile')).to.equal('package');
    });

    it('parses syntactically correct key-value flags with many spaces successfully', () => {
      // Act
      const sfCmd = new ArtifactDeploySfCommand('package:install');
      sfCmd.parseFlags('   upgrade-type=DeprecateOnly      wait=20  ');

      // Assert
      expect(Array.from(sfCmd.commandFlags.keys())).to.deep.equal(['upgrade-type', 'wait']);
      expect(sfCmd.commandFlags.get('upgrade-type')).to.equal('DeprecateOnly');
      expect(sfCmd.commandFlags.get('wait')).to.equal('20');
    });

    it('parses syntactically correct key flags successfully', () => {
      // Act
      const sfCmd = new ArtifactDeploySfCommand('project:deploy:start');
      sfCmd.parseFlags('ignore-conflicts verbose');

      // Assert
      expect(Array.from(sfCmd.commandFlags.keys())).to.deep.equal(['ignore-conflicts', 'verbose']);
      expect(sfCmd.commandFlags.get('ignore-conflicts')).to.be.undefined;
      expect(sfCmd.commandFlags.get('verbose')).to.be.undefined;
    });

    it('overrides flags from initialisation with parsed flags', () => {
      // Act
      const sfCmd = new ArtifactDeploySfCommand('project:deploy:start', [{ name: 'wait', value: '10' }]);
      sfCmd.parseFlags('ignore-conflicts wait=20');

      // Assert
      expect(Array.from(sfCmd.commandFlags.keys())).to.deep.equal(['wait', 'ignore-conflicts']);
      expect(sfCmd.commandFlags.get('ignore-conflicts')).to.be.undefined;
      expect(sfCmd.commandFlags.get('wait')).to.equal('20');
    });

    it('ignores trailing dashes (-- and -)', () => {
      // Act
      const sfCmd = new ArtifactDeploySfCommand('package:install');
      sfCmd.parseFlags('--ignore-conflicts');
      sfCmd.parseFlags('-other-flag');

      // Assert
      expect(Array.from(sfCmd.commandFlags.keys())).to.deep.equal(['ignore-conflicts', 'other-flag']);
    });

    it('ignores empty flags string', () => {
      // Act
      const sfCmd = new ArtifactDeploySfCommand('package:install');
      sfCmd.parseFlags('');

      // Assert
      expect(Array.from(sfCmd.commandFlags.keys())).to.deep.equal([]);
    });

    it('ignores undefined flags string', () => {
      // Act
      const sfCmd = new ArtifactDeploySfCommand('package:install');
      sfCmd.parseFlags(undefined);

      // Assert
      expect(Array.from(sfCmd.commandFlags.keys())).to.deep.equal([]);
    });

    it('overrides initialised flag with manual flag', () => {
      // Act
      const sfCmd = new ArtifactDeploySfCommand('package:install', [{ name: 'installation-key', value: 'abc' }]);
      sfCmd.addFlag('installation-key', 'def');

      // Assert
      expect(sfCmd.commandFlags.get('installation-key')).to.equal('def');
    });

    it('overrides initialised flag with empty flag', () => {
      // Act
      const sfCmd = new ArtifactDeploySfCommand('package:install', [{ name: 'installation-key', value: 'abc' }]);
      sfCmd.addFlag('installation-key', undefined);

      // Assert
      expect(sfCmd.commandFlags.get('installation-key')).to.equal(undefined);
      expect(sfCmd.buildConfig()).to.deep.equal({
        name: 'package:install',
        args: ['--installation-key'],
      });
    });
  });
});

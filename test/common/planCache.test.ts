import { expect } from 'chai';
import PlanCache from '../../src/common/planCache.js';

describe('plan cache', () => {
  afterEach(() => {
    PlanCache.flush();
  });

  it('returns single chunk for id length below chunk size', () => {
    // Arrange
    const ids = [];
    for (let i = 0; i < PlanCache.CHUNK_SIZE; i++) {
      ids.push(`A${i}`);
    }
    PlanCache.push('myIds', ids);

    // Act
    const returnedIds = PlanCache.getChunks('myIds');

    // Assert
    expect(returnedIds.length).equals(1);
    expect(returnedIds[0].length).equals(ids.length);
  });

  it('returns multiple chunks for id length above chunk size', () => {
    // Arrange
    PlanCache.CHUNK_SIZE = 100;
    const ids = [];
    for (let i = 0; i < PlanCache.CHUNK_SIZE * 5 - 10; i++) {
      ids.push(`A${i}`);
    }
    PlanCache.push('myIds', ids);

    // Act
    const returnedIds = PlanCache.getChunks('myIds');

    // Assert
    expect(returnedIds.length).equals(5);
    expect(returnedIds[0].length).equals(PlanCache.CHUNK_SIZE);
    expect(returnedIds[1].length).equals(PlanCache.CHUNK_SIZE);
    expect(returnedIds[2].length).equals(PlanCache.CHUNK_SIZE);
    expect(returnedIds[3].length).equals(PlanCache.CHUNK_SIZE);
    expect(returnedIds[4].length).equals(PlanCache.CHUNK_SIZE - 10);
  });
});

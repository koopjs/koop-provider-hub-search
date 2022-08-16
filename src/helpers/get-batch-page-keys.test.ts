import { getBatchPageKeys } from "./get-batch-page-keys"

describe('getBatchPageKeys function', () => {
  it('returns empty array when number of batches is zero', () => {
    // Test
    const pageKeys = getBatchPageKeys(0, 5, 100);
    
    // Assert
    expect(pageKeys).toHaveLength(0);
  });

  it('returns the correct page key for a single batch', () => {
    // Test
    const pageKeys = getBatchPageKeys(1, 5, 100);
    const pageKeysAsObjects = pageKeys.map((pageKey: string) => {
      return JSON.parse(Buffer.from(pageKey, 'base64').toString('ascii'));
    });

    // Assert
    expect(pageKeysAsObjects).toHaveLength(1);
    expect(pageKeysAsObjects[0]).toEqual({
      hub: {
        size: 100,
        start: 1
      },
      ago: {
        start: 1,
        size: 0
      }
    });
  });

  it('returns the correct page key for a multiple batchws', () => {
    // Test
    const pageKeys = getBatchPageKeys(3, 5, 100);
    const pageKeysAsObjects = pageKeys.map((pageKey: string) => {
      return JSON.parse(Buffer.from(pageKey, 'base64').toString('ascii'));
    });

    // Assert
    expect(pageKeysAsObjects).toHaveLength(3);
    expect(pageKeysAsObjects[0]).toEqual({
      hub: {
        size: 100,
        start: 1
      },
      ago: {
        start: 1,
        size: 0
      }
    });
    expect(pageKeysAsObjects[1]).toEqual({
      hub: {
        size: 100,
        start: 501
      },
      ago: {
        start: 1,
        size: 0
      }
    });
    expect(pageKeysAsObjects[2]).toEqual({
      hub: {
        size: 100,
        start: 1001
      },
      ago: {
        start: 1,
        size: 0
      }
    });
  });
})
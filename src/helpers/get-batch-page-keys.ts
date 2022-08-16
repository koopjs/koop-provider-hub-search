export const getBatchPageKeys = (numBatches: number, pagesPerBatch: number, pageSize: number): string[] => {
  const pageKeys = [];

  for (let i = 0; i < numBatches; i++) {
    pageKeys.push({
      hub: {
        size: pageSize,
        // Start at 1
        start: 1 + (i * pagesPerBatch * pageSize),
      },
      ago: {
        size: 0,
        start: 1,
      }
    });
  }

  return pageKeys.map((key) => {
    const json = JSON.stringify(key);
    return Buffer.from(json).toString('base64');
  });
};

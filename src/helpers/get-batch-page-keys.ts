export const getBatchPageKeys = (numBatches: number, pagesPerBatch: number, pageSize: number, limit?: number | undefined): string[] => {
  const pageKeys = [];
  for (let i = 0; i < numBatches; i++) {
    pageKeys.push({
      hub: {
        // No default paging for the last batch if limit exists
        size: getPageSize(pageSize, i, numBatches, limit, pagesPerBatch),
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

/*  
  Returns page size based on the current batch and limit. If limit is not provided
  page size needs to be same for all batches else, it needs to be modified
  for the last batch which would be the total number of items remaining instead
  of default page size provided. 
*/
const getPageSize = (pageSize: number, currentBatch: number, totalBatch: number, limit: number, pagesPerBatch: number) => {
  return isNaN(limit) 
    ? pageSize 
    : (currentBatch === (totalBatch - 1)) 
      ? Math.abs((currentBatch * pagesPerBatch * pageSize) - limit) 
      : pageSize;
};

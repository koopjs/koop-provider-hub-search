import * as _ from 'lodash';
import { IContentSearchRequest } from "@esri/hub-search";
import { fetchTotalResults } from "./fetch-total-results";

// For now, DO NOT make configurable.
const MAX_NUM_BATCHES = 5;

export const getBatchingParams = async (request: IContentSearchRequest, limit?: number | undefined): Promise<
  { pageSize: number, pagesPerBatch: number, numBatches: number }
> => {
  const total: number = limit || await fetchTotalResults(request);
  if (!total || !Number.isInteger(total)) {
    return { pageSize: 0, pagesPerBatch: 0, numBatches: 0 };
  }

  const pageSize: number = getPageSize(_.get(request, 'options.page'));
  let numBatches = getNumberOfBatches(total, pageSize);
  const pagesPerBatch: number = getPagesPerBatch(total, numBatches, pageSize);
  // revise total calcualted number of batches if limit exists
  // essential to customize last batch paging
  numBatches = isNaN(limit) ? numBatches : Math.ceil(limit / (pagesPerBatch * pageSize));
  return { pageSize, pagesPerBatch, numBatches };
};

const getPageSize = (page: string) => {
  if (!page) {
    return 100;
  }

  try {
    const pageObj = JSON.parse(Buffer.from(page, 'base64').toString('ascii'));
    const pageSize = _.get(pageObj, 'hub.size', 100);
    if (!Number.isInteger(pageSize)) {
      throw new Error(`Invalid size of: ${pageSize}`);
    }
    return pageSize;
  } catch (err) {
    console.error('Invalid page key, using default', err.message);
    return 100;
  }
};

const getNumberOfBatches = (total: number, pageSize: number): number => {
  const totalPages = Math.ceil(total / pageSize);
  return Math.min(totalPages, MAX_NUM_BATCHES);
};

const getPagesPerBatch = (numResults, numBatches, pageSize): number => {
  const resultsPerBatch = Math.ceil(numResults / numBatches);
  return Math.ceil(resultsPerBatch / pageSize);
};

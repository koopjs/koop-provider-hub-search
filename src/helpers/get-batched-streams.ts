import * as _ from 'lodash';
import { IContentSearchRequest } from "@esri/hub-search";
import { getBatchPageKeys } from './get-batch-page-keys';
import { getBatchingParams } from './get-batching-params';
import { PagingStream } from '../paging-stream';
import { getPagingStream } from './get-paging-stream';

export const getBatchedStreams = async (request: IContentSearchRequest, limit?: number | undefined): Promise<PagingStream[]> => {    
  const { numBatches, pagesPerBatch, pageSize } = await getBatchingParams(request, limit);
  const pageKeys: string[] = await getBatchPageKeys( 
    numBatches, 
    pagesPerBatch, 
    pageSize, 
    limit
  );
  const requests: IContentSearchRequest[] = pageKeys.map((key: string) => {
    const clone = _.cloneDeep(request);
    _.set(clone, 'options.page', key);
    return clone;
  });
  return requests.map((batchRequest: IContentSearchRequest, i: number, requests: IContentSearchRequest[]) => {
    return getPagingStream(batchRequest, limit ? (i + 1 === requests.length ? 1 : pagesPerBatch) : pagesPerBatch);
  });
};

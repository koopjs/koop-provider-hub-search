import * as _ from 'lodash';
import { IContentSearchRequest } from "@esri/hub-search";
import { getBatchPageKeys } from './get-batch-page-keys';
import { getBatchingParams } from './get-batching-params';
import { PagingStream } from '../paging-stream';
import { getPagingStream } from './get-paging-stream';

export const getBatchedStreams = async (request: IContentSearchRequest): Promise<PagingStream[]> => {    
  const { numBatches, pagesPerBatch, pageSize } = await getBatchingParams(request);
  const pageKeys: string[] = await getBatchPageKeys(numBatches, pagesPerBatch, pageSize);
  const requests: IContentSearchRequest[] = pageKeys.map((key: string) => {
    const clone = _.cloneDeep(request);
    _.set(clone, 'options.page', key);
    return clone;
  });
  return requests.map((batchRequest: IContentSearchRequest) => {
    return getPagingStream(batchRequest, pagesPerBatch);
  });
};

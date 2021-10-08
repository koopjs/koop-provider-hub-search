require('isomorphic-fetch');
require('isomorphic-form-data');
import * as _ from 'lodash';
import { Request } from 'express';
import { PagingStream } from './paging-stream';
import { IContentSearchRequest, IContentSearchResponse, searchContent } from '@esri/hub-search';
import { PassThrough } from 'stream';

// For now, DO NOT make configurable.
// Just an immutable number, so ok to be in closure
const MAX_NUM_BATCHES = 5;

export class HubApiModel {

  async getStream (request: Request) {
    const searchRequest: IContentSearchRequest = request.res.locals.searchRequest;
    this.preprocessSearchRequest(searchRequest);

    const { numBatches, pagesPerBatch, pageSize } = await this.getBatchPagingParams(searchRequest);
    const pageKeys: string[] = this.getPageKeysForEachBatch(numBatches, pagesPerBatch, pageSize);

    const searchRequests = this.getBatchedRequests(searchRequest, pageKeys);

    const searchStreamPromises: Array<Promise<PagingStream>>  = searchRequests.map(async (batchRequest: IContentSearchRequest) => {
      return this.getPagingStream(batchRequest, pagesPerBatch);
    });

    const searchStreams = await Promise.all(searchStreamPromises);

    let pass = new PassThrough({ objectMode: true });
    let waiting = searchStreams.length;
    for (const stream of searchStreams) {
        pass = stream.pipe(pass, {end: false});
        stream.once('end', () => {
          waiting--;
          if (waiting === 0) {
            pass.emit('end');
          }
        });

    }

    return pass;
  }

  // TODO remove when koop-core no longer requires
  getData () {}

  private async getBatchPagingParams(request: IContentSearchRequest): Promise<
    { pageSize: number, pagesPerBatch: number, numBatches: number }
  > {
    const total: number = await this.getTotalNumResults(request);
    const pageSize: number = this.getPageSize(request);
    const numBatches = this.getNumberOfBatches(total, pageSize);
    const pagesPerBatch: number = this.getPagesPerBatch(total, numBatches, pageSize);
    return { pageSize, pagesPerBatch, numBatches };
  }

  private getBatchedRequests(
    request: IContentSearchRequest,
    pageKeys: string[],
  ): IContentSearchRequest[] {    
    return pageKeys.map((key: string) => {
      const clone = _.cloneDeep(request);
      _.set(clone, 'options.page', key);
      return clone;
    });
  }

  private preprocessSearchRequest(searchRequest: IContentSearchRequest): void {
    if (!_.has(searchRequest, 'options.portal')) {
      _.set(searchRequest, 'options.portal', 'https://www.arcgis.com');
    }
  }

  private async getTotalNumResults(request: IContentSearchRequest): Promise<number> {
    // Don't overwrite!
    const clone = _.cloneDeep(request);

    // Need the total number of results to determine pagination range for each batch
    // Use this hardcoded page key
    // Doesn't return any results, just gets total
    const page = 'eyJodWIiOnsic2l6ZSI6MH0sImFnbyI6eyJzaXplIjowfX0=';
    _.set(clone, 'options.page', page);
    
    const response = await searchContent(clone);
    return response.total;
  }

  private getPageSize(request: IContentSearchRequest): number {
    const page = _.get(request, 'options.page');

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
  }

  private getNumberOfBatches(total: number, pageSize: number): number {
    const totalPages = Math.ceil(total / pageSize) || 1;
    return Math.min(totalPages, MAX_NUM_BATCHES);
  }

  private getPagesPerBatch(numResults, numBatches, pageSize): number {
    const resultsPerBatch = Math.trunc(numResults / numBatches) + 1;
    return Math.trunc(resultsPerBatch / pageSize) + 1;
  }

  private getPageKeysForEachBatch(numBatches, pagesPerBatch, pageSize): string[] {
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
  }

  private getPagingStream(request: IContentSearchRequest, pagesPerBatch: number): PagingStream {
    return new PagingStream({
      firstPageParams: request,

      loadPage: (params: IContentSearchRequest | IContentSearchResponse['next']) => {
        if (typeof params === 'function') {
          return params();
        }

        return searchContent(params); // first page request
      },

      streamPage: (response, push) => response.results.forEach(result => push(result)),

      getNextPageParams: response => response.hasNext && response.next,

      pageLimit: pagesPerBatch
    });
  }
}
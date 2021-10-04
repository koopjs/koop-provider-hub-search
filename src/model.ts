require('isomorphic-fetch');
require('isomorphic-form-data');
import * as _ from 'lodash';
import { Request } from 'express';
import { PagingStream } from './paging-stream';
import { IContentSearchRequest, IContentSearchResponse, searchContent } from '@esri/hub-search';

export class HubApiModel {
  private totalResults = 0;

  getTotalResults () { return this.totalResults; }

  getStream (request: Request) {
    const searchRequest: IContentSearchRequest = request.res.locals.searchRequest;
    const pagesPerBatch: number = request.res.locals.pagesPerBatch;

    if (!_.has(searchRequest, 'options.portal')) {
      _.set(searchRequest, 'options.portal', 'https://www.arcgis.com');
    }

    const searchApiStream = new PagingStream({
      firstPageParams: searchRequest,

      loadPage: (params: IContentSearchRequest | IContentSearchResponse['next']) => {
        if (typeof params === 'function') {
          return params();
        }
        this.totalResults = 0;
        return searchContent(params); // first page request
      },

      streamPage: (response, push) => response.results.forEach(result => {
        this.totalResults++;
        push(result);
      }),

      getNextPageParams: response => response.hasNext && response.next,

      resetResults: () => this.totalResults = 0,

      pagesPerBatch,
    });

    return searchApiStream;
  }

  // TODO remove when koop-core no longer requires
  getData () {}
}
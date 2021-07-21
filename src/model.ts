require('isomorphic-fetch');
import * as _ from 'lodash';
import { Request } from 'express';
import { PagingStream } from './paging-stream';
import { searchContent } from '@esri/hub-search';
import { IContentSearchRequest } from './types';

export class HubApiModel {

  getStream (request: Request) {
    const searchRequest: IContentSearchRequest = request.res.locals.searchRequest;

    // TODO support multiple environments
    _.set(searchRequest, 'options.portal', 'https://www.arcgis.com');

    const searchApiStream = new PagingStream({
      firstPageParams: searchRequest,

      loadPage: (params: IContentSearchRequest | any) => {
        if (params.next) {
          return params.next();
        }

        return searchContent(params); // first page request
      },

      streamPage: (response, push) => response.results.forEach(result => push(result)),

      getNextPageParams: response => response.hasNext && response.next
    });

    return searchApiStream;
  }

  // TODO remove when koop-core no longer requires
  getData () {}
}
import { Request } from 'express';
import { PagingStream } from './paging-stream';
import { ISearchApiOptions } from './types';
import { getSearchQueryParams } from './get-search-query-params';

export class HubApiModel {

  getStream (request: Request) {
    const searchOptions: ISearchApiOptions = request.res.locals.searchOptions;

    // TODO support multiple environments
    const portalUrl = 'https://hub.arcgis.com';

    const searchApiStream = new PagingStream({
      firstPage: `${portalUrl}/api/v3/datasets?${getSearchQueryParams(searchOptions)}`,

      loadPage: (url: string) => fetch(url).then(res => res.json()),

      streamPage: (response, push) => response.data.forEach(dataset => push(dataset)),

      getNextPage: response => response.links.next
    });

    return searchApiStream;
  }

  // TODO remove when koop-core no longer requires
  getData () {}
}
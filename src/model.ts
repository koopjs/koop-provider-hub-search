import { Request } from 'express';
import { PagingStream } from './paging-stream';
import { ISearchApiOptions } from './types';
import { getSearchQueryParams } from './get-search-query-params';

export class HubApiModel {
  private _options: any;

  constructor (options: any) {
    this._options = options;
  }

  getStream (request: Request) {
    // TODO revisit how we get these search options
    const searchOptions: ISearchApiOptions = request.app.locals.searchOptions;
    const siteUrl = request.app.locals.hubSiteUrl || this._options.defaultSiteUrl;

    const searchApiStream = new PagingStream({
      firstPage: `${siteUrl}?${getSearchQueryParams(searchOptions)}`,

      loadPage: (url: string) => fetch(url).then(res => res.json()),

      streamPage: (response, push) => response.data.forEach(dataset => push(dataset)),

      getNextPage: response => response.links.next
    });

    return searchApiStream;
  }
}
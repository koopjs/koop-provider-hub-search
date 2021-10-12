import { IContentSearchRequest, IContentSearchResponse, searchContent } from "@esri/hub-search";
import { PagingStream } from "../paging-stream";

export const getPagingStream = (request: IContentSearchRequest, pagesPerBatch?: number): PagingStream => {
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
};

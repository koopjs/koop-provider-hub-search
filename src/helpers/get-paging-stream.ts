import { IContentSearchRequest, searchDatasets } from "@esri/hub-search";
import { PagingStream } from "../paging-stream";

export const getPagingStream = (request: IContentSearchRequest, pagesPerBatch?: number): PagingStream => {
  return new PagingStream({
    firstPageParams: request,

    loadPage: (params: IContentSearchRequest | string) => {
      if (typeof params === 'string') {
        return fetch(params)
          .then(res => res.json());
      }

      return searchDatasets(params); // first page request
    },

    streamPage: (response, push) => response.data.forEach(result => push(result.attributes)),

    getNextPageParams: response => response.meta?.next && response.meta.next,

    pageLimit: pagesPerBatch
  });
};

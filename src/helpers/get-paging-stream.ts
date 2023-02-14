import { IContentSearchRequest, searchDatasets } from "@esri/hub-search";
import { PagingStream } from "../paging-stream";
import { enrichDataset, HubSite } from "./enrich-dataset";
export const getPagingStream = (searchRequest: IContentSearchRequest, hubSite: HubSite, pagesPerBatch?: number): PagingStream => {
  return new PagingStream({
    firstPageParams: searchRequest,

    loadPage: (params: IContentSearchRequest | string) => {
      if (typeof params === 'string') {
        return fetch(params)
          .then(res => res.json());
      }

      return searchDatasets(params); // first page request
    },

    streamPage: (response, push) => response.data.forEach(result => push(enrichDataset(result.attributes, hubSite))),

    getNextPageParams: response => response.meta?.next,

    pageLimit: pagesPerBatch
  });
};

import { IModel } from "@esri/hub-common";
import { IContentSearchRequest, searchDatasets } from "@esri/hub-search";
import { PagingStream } from "../paging-stream";
import { enrichDataset } from "./enrich-dataset";

export const getPagingStream =
  (request: IContentSearchRequest, siteUrl: string, siteModel: IModel, pagesPerBatch?: number): PagingStream => {
    return new PagingStream({
      firstPageParams: request,

      loadPage: (params: IContentSearchRequest | string) => {
        if (typeof params === 'string') {
          return fetch(params)
            .then(res => res.json());
        }

        return searchDatasets(params); // first page request
      },

      streamPage: (response, push) => response.data.forEach(result => push(enrichDataset(result.attributes, siteUrl, request.options.portal, siteModel))),

      getNextPageParams: response => response.meta?.next,

      pageLimit: pagesPerBatch
    });
  };

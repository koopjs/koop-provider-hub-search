import * as _ from 'lodash';
import { IContentSearchRequest, searchContent } from "@esri/hub-search";

export const fetchTotalResults = async (request: IContentSearchRequest): Promise<number> => {
  // Don't overwrite!
  const clone = _.cloneDeep(request);

  // Need the total number of results to determine pagination range for each batch
  // Use this hardcoded page key
  // Doesn't return any results, just gets total
  const page = Buffer.from(
    JSON.stringify({
      hub: {
        size: 0,
      },
      ago: {
        size: 0,
      }
    }
  )).toString('base64');
  _.set(clone, 'options.page', page);

  const response = await searchContent(clone);
  return response.total;
};

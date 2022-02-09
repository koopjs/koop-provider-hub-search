require('isomorphic-fetch');
require('isomorphic-form-data');

import * as _ from 'lodash';
import { Request } from 'express';
import { IContentSearchRequest } from '@esri/hub-search';
import { PassThrough } from 'stream';
import { PagingStream } from './paging-stream';
import { getBatchedStreams } from './helpers/get-batched-streams';
import { fetchSite, getHubApiUrl, getPortalApiUrl, hubApiRequest, RemoteServerError } from '@esri/hub-common';

export class HubApiModel {

  async getStream (request: Request) {
    const searchRequest: IContentSearchRequest = request.res.locals.searchRequest;
    this.preprocessSearchRequest(searchRequest);

    if (searchRequest.options.fields) {
      const validFields: string[] = await hubApiRequest('/fields');
      this.validateFields(searchRequest, validFields);
    }

    // Only fetch site if site is provided and either group or orgid is undefined
    if (
      searchRequest.options.site && 
      (!searchRequest.filter.group || !searchRequest.filter.orgid)
    ) {
      const siteCatalog = await this.getSiteCatalog(searchRequest, searchRequest.options.site);
      if (!searchRequest.filter.group) {
        searchRequest.filter.group = siteCatalog.groups;
      }
      if (!searchRequest.filter.orgid) {
        searchRequest.filter.orgid = siteCatalog.orgId;
      }
    }

    const pagingStreams: PagingStream[] = await getBatchedStreams(searchRequest);

    let pass = new PassThrough({ objectMode: true });
    let waiting = pagingStreams.length;

    if (!waiting) {
      pass.end(() => {});
      return pass;
    }

    for (const stream of pagingStreams) {
        stream.on('error', err => {
          console.error(err);
          pass.emit('error', err);
        });
        pass = stream.pipe(pass, { end: false });
        stream.once('end', () => {
          --waiting;
          if (waiting === 0) {
            pass.end(() => {});
          }
        });
    }

    return pass;
  }

  // TODO remove when koop-core no longer requires
  getData () {}

  private preprocessSearchRequest(searchRequest: IContentSearchRequest): void {
    if (!searchRequest.filter) {
      searchRequest.filter = {};
    }

    if (!searchRequest.options) {
      searchRequest.options = {};
    }

    if (!_.has(searchRequest, 'options.portal')) {
      _.set(searchRequest, 'options.portal', 'https://www.arcgis.com');
    }
  }

  private validateFields(searchRequest: IContentSearchRequest, validFields: string[]) {
    const invalidFields: string[] = [];

    for (const field of searchRequest.options.fields.split(',')) {
      if (!validFields.includes(field)) {
        invalidFields.push(field);
      }
    }

    if (invalidFields.length) {
      throw new RemoteServerError(
        `The config has the following invalid entries and cannot be saved: ${invalidFields.join(', ')}`,
        getHubApiUrl(searchRequest.options.portal),
        400
      );
    }
  }

  private async getSiteCatalog(searchRequest: IContentSearchRequest, site: string) {
    const requestOptions = {
      authentication: searchRequest.options.authentication,
      isPortal: searchRequest.options.isPortal,
      hubApiUrl: getHubApiUrl(searchRequest.options.portal),
      portal: getPortalApiUrl(searchRequest.options.portal),
    };

    const siteModel = await fetchSite(site, requestOptions);

    return _.get(siteModel, 'data.catalog', {});
  }
}
require('isomorphic-fetch');
require('isomorphic-form-data');

import * as _ from 'lodash';
import { Request } from 'express';
import { IContentFieldFilter, IContentSearchRequest } from '@esri/hub-search';
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
      (
        !this.scopedFieldValueIsValid(searchRequest.filter.group) || 
        !this.scopedFieldValueIsValid(searchRequest.filter.orgid)
      )
    ) {
      const siteCatalog = await this.getSiteCatalog(searchRequest, searchRequest.options.site);
      if (!this.scopedFieldValueIsValid(searchRequest.filter.group)) {
        searchRequest.filter.group = siteCatalog.groups;
      }
      if (!this.scopedFieldValueIsValid(searchRequest.filter.orgid)) {
        searchRequest.filter.orgid = siteCatalog.orgId;
      }
    }

    // Validate the scope to ensure that a group, org, and/or id are present to avoid
    // scraping entire database
    this.validateRequestScope(searchRequest);

    const limit = Number(request.query?.limit) || undefined;
    
    const pagingStreams: PagingStream[] = await getBatchedStreams(searchRequest, limit);

    return this.combineStreams(pagingStreams);
  }

  private combineStreams(streams) {
    const stream = new PassThrough({ objectMode: true });
    if (streams.length > 0) {
      this._combineStreams(streams, stream).catch((err) => stream.destroy(err));
    } else {
      stream.end(() => {});
    }
    return stream;
  }
  
  private async _combineStreams(sources, destination) {
    for (const stream of sources) {
      await new Promise((resolve, reject) => {
        stream.pipe(destination, { end: false });
        stream.on('end', resolve);
        stream.on('error', reject);
      });
    }
    destination.emit('end');
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

  private validateRequestScope(searchRequest: IContentSearchRequest): void {
    if (
      !searchRequest.filter.id &&
      !this.scopedFieldValueIsValid(searchRequest.filter.group) &&
      !this.scopedFieldValueIsValid(searchRequest.filter.orgid)
    ) {
      throw new RemoteServerError(
        'The request must have at least one of the following filters: "id", "group", "orgid". If you provided a "site" option, ensure the site catalog has group and/or org information',
        getHubApiUrl(searchRequest.options.portal),
        400
      );
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

  private scopedFieldValueIsValid(val: string | string[] | IContentFieldFilter): boolean {
    if (!val) {
      return false;
    } else if (typeof val === 'string') {
      return !!val;
    } else if (Array.isArray(val)) {
      return !!val.length;
    } else {
      return Array.isArray(val.value) && !!val.value.length;
    }
  }
}
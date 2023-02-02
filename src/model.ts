require('isomorphic-fetch');
require('isomorphic-form-data');

import * as _ from 'lodash';
import { Request } from 'express';
import { IContentFieldFilter, IContentSearchRequest } from '@esri/hub-search';
import { PassThrough } from 'stream';
import { PagingStream } from './paging-stream';
import { getBatchedStreams } from './helpers/get-batched-streams';
import { fetchSiteModel, getHubApiUrl, getPortalApiUrl, hubApiRequest, IModel, RemoteServerError } from '@esri/hub-common';

const REQUIRED_FIELDS = [
  'id', // used for the dataset landing page URL
  'type', // used for the dataset landing page URL
  'slug', // used for the dataset landing page URL
  'access', // used for detecting proxied csv's
  'size', // used for detecting proxied csv's
  'licenseInfo', // required for license resolution
  'structuredLicense', // required for license resolution
];

// additional fields due to dataset enrichment
const ADDON_FIELDS = [
  'hubLandingPage',
  'accessUrlCSV',
  'isLayer',
  'accessUrlKML',
  'accessUrlShapeFile',
  'accessUrlWFS',
  'accessUrlWMS',
  'accessUrlGeoJSON',
  'license'
];

type HubApiRequest = {
  res?: {
    locals: {
      searchRequestBody?: IContentSearchRequest,
      siteModel?: IModel,
      arcgisPortal?: string
      siteIdentifier?: string,
    }
  }
  query?: {
    limit?: number
  }
}

export class HubApiModel {

  async getStream(request: Request) {
    const { res: { locals: { searchRequestBody, siteModel, arcgisPortal, siteIdentifier } }, query: { limit } }: HubApiRequest = request;
    const hubSiteModel = siteModel || await this.fetchHubSiteModel(siteIdentifier, this.getRequestOptions(arcgisPortal));

    this.preprocessSearchRequest(searchRequestBody);

    searchRequestBody.options.fields =
      `${searchRequestBody.options.fields},${REQUIRED_FIELDS.join(',')}`;

    if (searchRequestBody.options.fields) {
      searchRequestBody.options.fields = this.getValidHubApiFields(searchRequestBody.options.fields);
      const validFields: string[] = await hubApiRequest('/fields');
      this.validateFields(searchRequestBody, validFields);
    }

    // Only fetch site if site is provided and either group or orgid is undefined
    if (
      searchRequestBody.options.site &&
      (
        !this.scopedFieldValueIsValid(searchRequestBody.filter.group) ||
        !this.scopedFieldValueIsValid(searchRequestBody.filter.orgid)
      )
    ) {
      const siteCatalog = await this.getSiteCatalog(searchRequestBody, searchRequestBody.options.site);
      if (!this.scopedFieldValueIsValid(searchRequestBody.filter.group)) {
        searchRequestBody.filter.group = siteCatalog.groups;
      }
      if (!this.scopedFieldValueIsValid(searchRequestBody.filter.orgid)) {
        searchRequestBody.filter.orgid = siteCatalog.orgId;
      }
    }

    // Validate the scope to ensure that a group, org, and/or id are present to avoid
    // scraping entire database
    this.validateRequestScope(searchRequestBody);

    const pagingStreams: PagingStream[] = await getBatchedStreams({
      request: searchRequestBody,
      siteUrl: siteIdentifier,
      siteModel: hubSiteModel,
      limit
    });

    const pass: PassThrough = new PassThrough({ objectMode: true });
    return searchRequestBody.options.sortField
      ? this.combineStreamsInSequence(pagingStreams, pass)
      : this.combineStreamsNotInSequence(pagingStreams, pass);
  }

  private getValidHubApiFields(fields: string): string {
    return fields.split(',').filter((field) => !ADDON_FIELDS.includes(field)).join(',');
  }

  private combineStreamsNotInSequence(streams: PagingStream[], pass: PassThrough): PassThrough {
    let waiting = streams.length;

    if (!waiting) {
      pass.end(() => { });
      return pass;
    }

    for (const stream of streams) {
      stream.on('error', err => {
        console.error(err);
        pass.emit('error', err);
      });
      pass = stream.pipe(pass, { end: false });
      stream.once('end', () => {
        --waiting;
        if (waiting === 0) {
          pass.end(() => { });
        }
      });
    }
    return pass;
  }

  private combineStreamsInSequence(streams: PagingStream[], pass: PassThrough): PassThrough {
    this._combineStreamsInSequence(streams, pass).catch((err) => pass.destroy(err));
    return pass;
  }

  private async _combineStreamsInSequence(sources: PagingStream[], destination: PassThrough): Promise<void> {
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
  getData() { }


  private async fetchHubSiteModel(hostname, opts): Promise<IModel> {
    try {
      return await fetchSiteModel(hostname, opts);
    } catch (err) {
      // Throw 404 if domain does not exist (first) or site is private (second)
      if (err.message.includes(':: 404') || err.response?.error?.code === 403) {
        throw new RemoteServerError(err.message, null, 404);
      }
      throw new RemoteServerError(err.message, null, 500);
    }
  }

  private getRequestOptions(portalUrl) {
    return {
      isPortal: false,
      hubApiUrl: getHubApiUrl(portalUrl),
      portal: getPortalApiUrl(portalUrl),
      authentication: null,
    };
  }

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

    const siteModel = await fetchSiteModel(site, requestOptions);

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
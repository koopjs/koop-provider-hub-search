require('isomorphic-fetch');
require('isomorphic-form-data');

import * as _ from 'lodash';
import { Request } from 'express';
import { IContentFieldFilter, IContentSearchRequest } from '@esri/hub-search';
import { PassThrough } from 'stream';
import { PagingStream } from './paging-stream';
import { getBatchedStreams } from './helpers/get-batched-streams';
import {
  fetchSiteModel, getHubApiUrl, getPortalApiUrl, hubApiRequest, IModel, RemoteServerError, lookupDomain, IDomainEntry
} from '@esri/hub-common';
import { REQUIRED_FIELDS, ADDON_FIELDS } from './helpers/fields';

type HubApiRequest = {
  app: {
    locals: {
      arcgisPortal?: string
    }
  }
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
    const { 
      app: { locals: { arcgisPortal } }, 
      res: { locals: { searchRequestBody, siteIdentifier } }, 
      query: { limit } 
    }: HubApiRequest = request;
    this.preprocessSearchRequest(searchRequestBody);

    if (searchRequestBody.options.fields) {
      searchRequestBody.options.fields = this.getValidHubApiFields(searchRequestBody.options.fields);
      const validFields: string[] = await hubApiRequest('/fields');
      this.validateFields(searchRequestBody, validFields);
    }

    // Only fetch site if site is provided and either group or orgid is undefined
    if (this.shouldFetchSite(searchRequestBody)) {
      await this.addGroupAndOrgId(searchRequestBody);
    }

    // Validate the scope to ensure that a group, org, and/or id are present to avoid
    // scraping entire database
    this.validateRequestScope(searchRequestBody);

    const searchRequestWithRequiredFields = this.addRequiredFields(searchRequestBody);
    const domainRecord: IDomainEntry = await this.getDomainRecord(arcgisPortal, siteIdentifier);

    const pagingStreams: PagingStream[] = await getBatchedStreams({
      request: searchRequestWithRequiredFields,
      siteUrl: siteIdentifier,
      portalUrl: arcgisPortal,
      orgBaseUrl: this.getOrgBaseUrl(domainRecord, arcgisPortal),
      orgTitle: domainRecord.orgTitle,
      limit
    });

    const pass: PassThrough = new PassThrough({ objectMode: true });
    return searchRequestWithRequiredFields.options.sortField
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

  private addRequiredFields(searchRequestBody: IContentSearchRequest) {
    const searchReqBody: IContentSearchRequest = _.cloneDeep(searchRequestBody);
    searchReqBody.options.fields =
      searchRequestBody.options.fields
        ? `${searchRequestBody.options.fields},${REQUIRED_FIELDS.join(',')}` :
        REQUIRED_FIELDS.join(',');
    return searchReqBody;
  }

  private async addGroupAndOrgId(searchRequestBody) {
    const siteCatalog = await this.getSiteCatalog(searchRequestBody, searchRequestBody.options.site);
    if (!this.scopedFieldValueIsValid(searchRequestBody.filter.group)) {
      searchRequestBody.filter.group = siteCatalog.groups;
    }
    if (!this.scopedFieldValueIsValid(searchRequestBody.filter.orgid)) {
      searchRequestBody.filter.orgid = siteCatalog.orgId;
    }
  }

  private combineStreamsInSequence(streams: PagingStream[], pass: PassThrough): PassThrough {
    this._combineStreamsInSequence(streams, pass);
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

  private shouldFetchSite(searchRequestBody: IContentSearchRequest): boolean {
    return searchRequestBody.options.site &&
      (
        !this.scopedFieldValueIsValid(searchRequestBody.filter.group) ||
        !this.scopedFieldValueIsValid(searchRequestBody.filter.orgid)
      );
  }

  private async getDomainRecord(portalUrl: string, siteUrl: string): Promise<IDomainEntry> {
    const requestOptions = {
      isPortal: false,
      hubApiUrl: getHubApiUrl(portalUrl),
      portal: getPortalApiUrl(portalUrl),
      authentication: null,
    };

    const domainRecord = (await lookupDomain(
      siteUrl,
      requestOptions,
    )) as IDomainEntry;

    return domainRecord;
  }

  private getOrgBaseUrl(domainRecord: IDomainEntry, portalUrl: string): string {
    let env: 'prod' | 'qa' | 'dev' = 'prod';
    if (/devext\.|mapsdev\./.test(portalUrl)) {
      env = 'dev';
    } else if (/qaext\.|mapsqa\./.test(portalUrl)) {
      env = 'qa';
    }

    return `https://${domainRecord.orgKey}.maps${env === 'prod' ? '' : env
      }.arcgis.com`;
  }

  // TODO remove when koop-core no longer requires
  getData() { }

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

    const siteModel = await this.fetchHubSiteModel(site, requestOptions);

    return _.get(siteModel, 'data.catalog', {});
  }

  private async fetchHubSiteModel(hostname, opts) {
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
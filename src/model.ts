require('isomorphic-fetch');
require('isomorphic-form-data');

import * as _ from 'lodash';
import { Request } from 'express';
import { IContentSearchRequest } from '@esri/hub-search';
import { PassThrough } from 'stream';
import { PagingStream } from './paging-stream';
import { getBatchedStreams } from './helpers/get-batched-streams';

export class HubApiModel {

  async getStream (request: Request) {
    const searchRequest: IContentSearchRequest = request.res.locals.searchRequest;
    this.preprocessSearchRequest(searchRequest);

    const pagingStreams: PagingStream[] = await getBatchedStreams(searchRequest);

    let pass = new PassThrough({ objectMode: true });
    let waiting = pagingStreams.length;

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
    if (!_.has(searchRequest, 'options.portal')) {
      _.set(searchRequest, 'options.portal', 'https://www.arcgis.com');
    }
  }
}
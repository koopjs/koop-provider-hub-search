import { Request } from 'express';
import { Readable } from 'stream';

export class HubApiModel {
  async getStream (request: Request) {
    console.log(request);

    const ret = new Readable({ read () {} });
    ret.push({ foo: 'bar' });
    ret.push(null);
    return ret;
  }
}
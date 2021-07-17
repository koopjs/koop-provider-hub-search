import { Readable } from "stream";

export interface PagingStreamOptions {
  firstRequest: any;
  makeRequest: (request: any) => Promise<any>;
  streamResponse: (response: any, push: typeof Readable.prototype.push) => any;
  getNextRequest: (response: any) => any;
}

export class PagingStream extends Readable {
  private _nextRequest;
  private _makeRequest;
  private _streamResponse;
  private _getNextRequest;

  constructor({
    firstRequest,
    makeRequest,
    streamResponse,
    getNextRequest
  }: PagingStreamOptions) {
    super({ objectMode: true });

    this._nextRequest = firstRequest;
    this._makeRequest = makeRequest;
    this._streamResponse = streamResponse;
    this._getNextRequest = getNextRequest;
  }

  async _read () {
    if (!this._nextRequest) return;

    // make the request
    const response = await this._makeRequest(this._nextRequest);

    // next request options... important that we do this before we call this.push
    // because that will open us up for another call to this method
    this._nextRequest = this._getNextRequest(response);

    // process response
    this._streamResponse(response, this.push.bind(this));

    // end stream if done
    if (!this._nextRequest) {
      this.push(null);
    }
  }
}
import { Readable } from "stream";

export interface PagingStreamOptions {
  firstPage: any;
  loadPage: (request: any) => Promise<any>;
  streamPage: (response: any, push: typeof Readable.prototype.push) => any;
  getNextPage: (response: any) => any;
}

export class PagingStream extends Readable {
  private _nextPage;
  private _loadPage;
  private _streamPage;
  private _getNextPage;

  constructor({
    firstPage,
    loadPage,
    streamPage,
    getNextPage
  }: PagingStreamOptions) {
    super({ objectMode: true });

    this._nextPage = firstPage;
    this._loadPage = loadPage;
    this._streamPage = streamPage;
    this._getNextPage = getNextPage;
  }

  async _read () {
    // make the request
    const response = await this._loadPage(this._nextPage);

    // next request options... important that we do this before we call this.push
    // because that will open us up for another call to this method
    this._nextPage = this._getNextPage(response);

    // process response
    this._streamPage(response, this.push.bind(this));

    // end stream if done
    if (!this._nextPage) {
      this.push(null);
    }
  }
}
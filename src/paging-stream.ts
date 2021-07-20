import { Readable } from "stream";

export interface PagingStreamOptions {
  firstPage: any;
  loadPage: (request: any) => Promise<any>;
  streamPage: (response: any, push: typeof Readable.prototype.push) => any;
  getNextPageParams: (response: any) => any;
}

export class PagingStream extends Readable {
  private _nextPageParams;
  private _loadPage;
  private _streamPage;
  private _getNextPageParams;

  constructor({
    firstPage,
    loadPage,
    streamPage,
    getNextPageParams
  }: PagingStreamOptions) {
    super({ objectMode: true });

    this._nextPageParams = firstPage;
    this._loadPage = loadPage;
    this._streamPage = streamPage;
    this._getNextPageParams = getNextPageParams;
  }

  async _read () {
    const response = await this._loadPage(this._nextPageParams);

    this._nextPageParams = this._getNextPageParams(response);

    this._streamPage(response, this.push.bind(this));

    if (!this._nextPageParams) {
      this.push(null);
    }
  }
}
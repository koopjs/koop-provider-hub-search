import { Readable } from "stream";

export interface PagingStreamOptions {
  firstPageParams: any;
  loadPage: (request: any) => Promise<any>;
  streamPage: (response: any, push: typeof Readable.prototype.push) => any;
  getNextPageParams: (response: any) => any;
  pageLimit?: number;
}

export class PagingStream extends Readable {
  private _nextPageParams;
  private _loadPage;
  private _streamPage;
  private _getNextPageParams;
  private _pageLimit;
  private _currPage = 0;

  constructor({
    firstPageParams,
    loadPage,
    streamPage,
    getNextPageParams,
    pageLimit = Number.MAX_SAFE_INTEGER
  }: PagingStreamOptions) {
    super({ objectMode: true });

    this._nextPageParams = firstPageParams;
    this._loadPage = loadPage;
    this._streamPage = streamPage;
    this._getNextPageParams = getNextPageParams;
    this._pageLimit = pageLimit;
  }

  async _read() {
    try {
      const response = await this._loadPage(this._nextPageParams);
      this._currPage++;

      this._nextPageParams = this._getNextPageParams(response);

      this._streamPage(response, this.push.bind(this));

      if (!this._nextPageParams || this._currPage >= this._pageLimit) {
        this.push(null);
      }
    } catch (err) {
      this.destroy(err);
      return;
    }
  }
}
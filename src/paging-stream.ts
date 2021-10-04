import { Readable } from "stream";

export interface PagingStreamOptions {
  firstPageParams: any;
  loadPage: (request: any) => Promise<any>;
  streamPage: (response: any, push: typeof Readable.prototype.push) => any;
  getNextPageParams: (response: any) => any;
  resetResults?: () => void;
  pagesPerBatch?: number;
}

export class PagingStream extends Readable {
  private _nextPageParams;
  private _loadPage;
  private _streamPage;
  private _getNextPageParams;
  private _resetResults;
  private _minPageTime;
  public _getMinPageTime;
  public _resetMinPageTime;
  private _pagesPerBatch = Number.MAX_SAFE_INTEGER;
  private _currPage = 0;

  constructor({
    firstPageParams,
    loadPage,
    streamPage,
    getNextPageParams,
    resetResults,
    pagesPerBatch,
  }: PagingStreamOptions) {
    super({ objectMode: true });

    this._nextPageParams = firstPageParams;
    this._loadPage = loadPage;
    this._streamPage = streamPage;
    this._getNextPageParams = getNextPageParams;
    this._resetResults = resetResults;
    this._minPageTime = Number.MAX_SAFE_INTEGER;
    this._getMinPageTime = () => this._minPageTime;
    this._resetMinPageTime = () => {
      this._minPageTime = Number.MAX_SAFE_INTEGER;
    };
    this._pagesPerBatch = pagesPerBatch;
  }

  async _read () {
    let response: any;
    const start = new Date().getTime();

    try {
      response = await this._loadPage(this._nextPageParams);
      this._currPage++;
    } catch (err) {
      this._resetResults();
      this._resetMinPageTime();
      this.destroy(err);
      return;
    }

    const end = new Date().getTime();

    if (!this._nextPageParams.apply) {
      console.log(`FETCHED PAGE ${this._currPage} WITH KEY ${this._nextPageParams.options?.page}`);
    } else {
      const query = JSON.parse(response.query);
      const key = query?.page?.key || '';
      const buffer = Buffer.from(key, 'base64');
      console.log(`FETCHED PAGE ${this._currPage} WITH KEY ${buffer.toString('utf-8')}`);
    }

    this._nextPageParams = this._getNextPageParams(response);

    if (this._nextPageParams) {
      if (end - start < this._minPageTime) {
        this._minPageTime = end - start;
      }
    }

    this._streamPage(response, this.push.bind(this));

    if (!this._nextPageParams || this._currPage >= this._pagesPerBatch) {
      this.push(null);
    }
  }
}
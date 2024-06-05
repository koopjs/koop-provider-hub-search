import * as faker from 'faker';
import { PagingStream } from '../src/paging-stream';

describe('paging stream', () => {
  let loadPageSpy: jest.Mock;
  let streamPageSpy: jest.Mock;
  let getNextPageParamsSpy: jest.Mock;

  beforeEach(() => {
    loadPageSpy = jest.fn();
    streamPageSpy = jest.fn();
    getNextPageParamsSpy = jest.fn();
  });

  it('loads and streams several pages', () => {
    const firstPageParams = faker.internet.url();

    const datasets = new Array(12).fill(null).map(() => {
      return { id: faker.datatype.uuid() };
    });

    const responses = [
      {
        data: [
          datasets[0],
          datasets[1],
          datasets[2],
        ],
        links: {
          next: faker.internet.url()
        }
      },
      {
        data: [
          datasets[3],
          datasets[4],
          datasets[5]
        ],
        links: {
          next: faker.internet.url()
        }
      },
      {
        data: [
          datasets[6],
          datasets[7],
          datasets[8]
        ],
        links: {
          next: faker.internet.url()
        }
      },
      {
        data: [
          datasets[9],
          datasets[10],
          datasets[11],
        ],
        links: { /* no next link */ }
      },
    ];

    let requestCounter = 0;
    loadPageSpy.mockImplementation(() => {
      const res = Promise.resolve(responses[requestCounter]);
      requestCounter++;
      return res;
    });
    streamPageSpy.mockImplementation((response, push) => response.data.forEach(push));
    getNextPageParamsSpy.mockImplementation(response => response.links.next);

    const stream = new PagingStream({
      firstPageParams,
      loadPage: loadPageSpy,
      streamPage: streamPageSpy,
      getNextPageParams: getNextPageParamsSpy
    });

    let dataCounter = 0;
    stream.on('data', data => {
      expect(data).toEqual(datasets[dataCounter]);
      dataCounter++;
    });

    return new Promise((resolve, reject) => stream.on('end', () => {
      try {
        // get all the mock requests and make sure they got passed to makeRequest
        // in the right order
        const mockRequestUrls = [firstPageParams, ...responses.map(res => res.links.next).filter(Boolean)];
        mockRequestUrls.forEach((url, i) => expect(loadPageSpy).toHaveBeenNthCalledWith(i+1, url));
        resolve('Test Complete');
      } catch (err) {
        reject(err);
      }
    }));
  });

  it('loads and streams only a limited number pages if a page limit is provided', () => {
    const firstPageParams = faker.internet.url();

    const datasets = new Array(12).fill(null).map(() => {
      return { id: faker.datatype.uuid() };
    });

    const responses = [
      {
        data: [
          datasets[0],
          datasets[1],
          datasets[2],
        ],
        links: {
          next: faker.internet.url()
        }
      },
      {
        data: [
          datasets[3],
          datasets[4],
          datasets[5]
        ],
        links: {
          next: faker.internet.url()
        }
      },
      {
        data: [
          datasets[6],
          datasets[7],
          datasets[8]
        ],
        links: {
          next: faker.internet.url()
        }
      },
      {
        data: [
          datasets[9],
          datasets[10],
          datasets[11],
        ],
        links: { /* no next link */ }
      },
    ];

    let requestCounter = 0;
    loadPageSpy.mockImplementation(() => {
      const res = Promise.resolve(responses[requestCounter]);
      requestCounter++;
      return res;
    });
    streamPageSpy.mockImplementation((response, push) => response.data.forEach(push));
    getNextPageParamsSpy.mockImplementation(response => response.links.next);

    const stream = new PagingStream({
      firstPageParams,
      loadPage: loadPageSpy,
      streamPage: streamPageSpy,
      getNextPageParams: getNextPageParamsSpy,
      pageLimit: 2,
    });

    let dataCounter = 0;
    stream.on('data', data => {
      expect(data).toEqual(datasets[dataCounter]);
      dataCounter++;
    });

    return new Promise((resolve, reject) => stream.on('end', () => {
      try {
        // get all the mock requests and make sure they got passed to makeRequest
        // in the right order
        const mockRequestUrls = [firstPageParams, ...responses.map(res => res.links.next).filter(Boolean)];
        expect(loadPageSpy).toBeCalledTimes(2)
        expect(loadPageSpy).toHaveBeenNthCalledWith(1, mockRequestUrls[0]);
        expect(loadPageSpy).toHaveBeenNthCalledWith(2, mockRequestUrls[1]);
        resolve('Test Complete');
      } catch (err) {
        reject(err);
      }
    }));
  });

  it('destroys stream if error occurs when loading a page results', () => {
    const requestError = new Error('REQUEST FAILED');
    loadPageSpy.mockRejectedValue(requestError);
    streamPageSpy.mockImplementation((response, push) => response.data.forEach(push));
    getNextPageParamsSpy.mockImplementation(response => response.links.next);

    const stream = new PagingStream({
      firstPageParams: null,
      loadPage: loadPageSpy,
      streamPage: streamPageSpy,
      getNextPageParams: getNextPageParamsSpy
    });

    stream.on('data', () => {
      throw Error('Stream should not emit data after erroring!')
    });

    return new Promise((resolve, reject) => stream.on('error', (err) => {
      try {
        expect(err).toEqual(requestError);
        expect(streamPageSpy).not.toHaveBeenCalled();
        expect(getNextPageParamsSpy).not.toHaveBeenCalled();
        resolve('Test Complete');
      } catch (err) {
        reject(err);
      }
    }));
  });

  it('destroys stream if error occurs streaming page', () => {
    const streamError = new Error('STREAM FAILED');
    loadPageSpy.mockResolvedValue({data: {itemid: '123s'}, links: { next: 'https://hub.arcgis.com/next'}});
    streamPageSpy.mockImplementation((_response, _push) =>  { throw streamError; });
    getNextPageParamsSpy.mockImplementation(response => {
      return response.links.next
    } );

    const stream = new PagingStream({
      firstPageParams: null,
      loadPage: loadPageSpy,
      streamPage: streamPageSpy,
      getNextPageParams: getNextPageParamsSpy
    });

    stream.on('data', () => {
      throw Error('Stream should not emit data after erroring!')
    });

    return new Promise((resolve, reject) => stream.on('error', (err) => {
      try {
        expect(err).toEqual(streamError);
        expect(streamPageSpy).toHaveBeenCalled();
        expect(getNextPageParamsSpy).toHaveBeenCalled();
        resolve('Test Complete');
      } catch (err) {
        reject(err);
      }
    }));
  });

  it('destroys stream if error occurs when getting next page params', () => {
    const nextPageError = new Error('PAGING FAILED');
    loadPageSpy.mockResolvedValue({data: {itemid: '123s'}, links: { next: 'https://hub.arcgis.com/next'}});
    streamPageSpy.mockImplementation((response, push) => response.data.forEach(push));

    getNextPageParamsSpy.mockImplementation(_response => { throw nextPageError; } );

    const stream = new PagingStream({
      firstPageParams: null,
      loadPage: loadPageSpy,
      streamPage: streamPageSpy,
      getNextPageParams: getNextPageParamsSpy
    });

    stream.on('data', () => {
      throw Error('Stream should not emit data after erroring!')
    });

    return new Promise((resolve, reject) => stream.on('error', (err) => {
      try {
        expect(err).toEqual(nextPageError);
        expect(streamPageSpy).not.toHaveBeenCalled();
        expect(getNextPageParamsSpy).toHaveBeenCalled();
        resolve('Test Complete');
      } catch (err) {
        reject(err);
      }
    }));
  });
});
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
    const firstPage = faker.internet.url();

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
      firstPage,
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
        const mockRequestUrls = [firstPage, ...responses.map(res => res.links.next).filter(Boolean)];
        mockRequestUrls.forEach((url, i) => expect(loadPageSpy).toHaveBeenNthCalledWith(i+1, url));
        resolve('Test Complete');
      } catch (err) {
        reject(err);
      }
    }));
  });
});
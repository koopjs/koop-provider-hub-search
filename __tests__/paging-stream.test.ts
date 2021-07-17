import * as faker from 'faker';
import { PagingStream } from '../src/paging-stream';

describe('paging stream', () => {
  let makeRequestSpy: jest.Mock;
  let streamResponseSpy: jest.Mock;
  let getNextRequestSpy: jest.Mock;

  beforeEach(() => {
    makeRequestSpy = jest.fn();
    streamResponseSpy = jest.fn();
    getNextRequestSpy = jest.fn();
  })

  it('loads and streams several pages', () => {
    const firstRequest = faker.internet.url();

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
    makeRequestSpy.mockImplementation(() => {
      const res = Promise.resolve(responses[requestCounter]);
      requestCounter++;
      return res;
    });
    streamResponseSpy.mockImplementation((response, push) => response.data.forEach(push));
    getNextRequestSpy.mockImplementation(response => response.links.next);

    const stream = new PagingStream({
      firstRequest,
      makeRequest: makeRequestSpy,
      streamResponse: streamResponseSpy,
      getNextRequest: getNextRequestSpy
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
        const mockRequestUrls = [firstRequest, ...responses.map(res => res.links.next).filter(Boolean)];
        mockRequestUrls.forEach((url, i) => expect(makeRequestSpy).toHaveBeenNthCalledWith(i+1, url))
        resolve('Test Complete');
      } catch (err) {
        reject(err);
      }
    }));
  });
});
# Koop Provider Hub Search

[![TypeScript version][ts-badge]][typescript-4-3]
[![Node.js version][nodejs-badge]][nodejs]
[![APLv2][license-badge]][license]
[![Build Status - GitHub Actions][gha-badge]][gha-ci]

This is a Koop provider that extracts datasets from the ArcGIS Hub Search API.

## Use - Streaming All Datasets
This provider plugin currently only supports [streaming](https://nodejs.org/api/stream.html#stream_readable_streams) ALL datasets matching a given search query. It performs searches using the [`searchContent`](https://esri.github.io/hub.js/api/search/searchContent/) function from [`@esri/hub.js`](https://esri.github.io/hub.js/) and requests all pages from the API in order.

### Define Search Parameters
To perform a search from an output plugin, attach an [`IContentSearchRequest`](https://esri.github.io/hub.js/api/search/IContentSearchRequest/) to the response.
```js
req.res.locals.searchRequest = {
  options: {
    site: 'my-site.hub.arcgis.com'
  },
  filter: {
    term: 'some search terms'
  }
};
```

#### Notes
A search request *must* be scoped to include at least one of the following:
- an "id" (`filter: { id: '<id here>' }`)
- at least one "group" (`filter: { group: ['<group id here>'] }`)
- an "orgid" (`filter: { orgid: '<or id here>' }`)
- a "site" (`options: { site: '<site here>' }`)

If none of the above are provided, an error will be returned. *Importantly*, if only a site is provided, it is still possible for an error to be returned if the site does not have an organization or group specified as part of its catalog.

### Pull the Readable Stream
Then pass the request object to `this.model.pullStream`.
```js
const docStream = await this.model.pullStream(req);
```

### Full Example
What you have now is a Node.js `Readable` stream. You can pipe the datasets from the readable through a transform stream in order to format them into some other type of output before sending them back to the browser by piping them to the Express.js response. The following simple example also uses the [`through2`](https://www.npmjs.com/package/through2) library to conveniently define a transform stream.

```js
async handleRequest (req, res) {
  req.res.locals.searchRequest = { /* some search params */ };

  const docStream = await this.model.pullStream(req);

  docStream
    .pipe(through2.obj(function (dataset, enc, callback) {
      const transformed = someTranformFunc(dataset);

      // the Express.js "res" Writable only accepts strings or Buffers
      this.push(JSON.stringify(transformed));
      callback();
    }))
    .pipe(res);
}
```

## Develop
```sh
# clone and install dependencies
git clone https://github.com/koopjs/koop-output-dcat-ap-201
cd koop-output-dcat-ap-201
npm i

# starts the example Koop app found in ./example-app.
npm run dev
```

## Test
Run the `npm t` commmand to spin up the automated tests.



[ts-badge]: https://img.shields.io/badge/TypeScript-4.3-blue.svg
[nodejs-badge]: https://img.shields.io/badge/Node.js->=%2014.16-blue.svg
[nodejs]: https://nodejs.org/dist/latest-v14.x/docs/api/
[gha-badge]: https://github.com/koopjs/koop-provider-hub-search/actions/workflows/nodejs.yml/badge.svg
[gha-ci]: https://github.com/koopjs/koop-provider-hub-search/actions/workflows/nodejs.yml
[typescript]: https://www.typescriptlang.org/
[typescript-4-3]: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-3.html
[license-badge]: https://img.shields.io/badge/license-APLv2-blue.svg
[license]: https://github.com/koopjs/koop-provider-hub-search/blob/main/LICENSE

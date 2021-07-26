const through2 = require('through2');

class Output {
  static type = 'output';
  static routes = [
    {
      path: '/content',
      methods: ['get'],
      handler: 'serve'
    }
  ];

  async serve (req, res) {
    req.res.locals.searchRequest = {
      options: {
        site: 'https://downloads-testing-prod-prod-pre-hub.hub.arcgis.com/search'
      }
    };

    const docStream = await this.model.pullStream(req);

    docStream
      .pipe(through2.obj(function (chunk, enc, callback) {
        this.push(JSON.stringify(chunk));
        callback();
      }))
      .pipe(res);
  }
}

module.exports = Output;
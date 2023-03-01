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
    req.res.locals.searchRequestBody = {
      filter: {
        group: ['6e23b09ac3944b3fb1f98b34a9fc33c4','358380575024451b8a0e496d871ad731','455c193b5e044d7c862080fd1087c656']
      },
     options: {
        fields: 'name,description,tags,created,modified,owner,orgContactEmail,extent,license'
      }
    };

    req.app.locals.arcgisPortal = 'https://www.arcgis.com';
    req.res.locals.siteIdentifier = 'opendata.dc.gov';
    
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
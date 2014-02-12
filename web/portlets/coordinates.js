
Portlet.register({
  name: 'coordinates',
  pretty_name: 'Coordinates',

  init: function(options) {
    Portlet.prototype.init.call(this, options);
    this.bindFrame('asserv_tm_xya', function(params) {
      var tds = this.content.find('td');
      $(tds[0]).text(params.x.toFixedHtml(0));
      $(tds[1]).text(params.y.toFixedHtml(0));
    });
  },
});


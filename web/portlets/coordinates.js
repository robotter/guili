
Portlet.register({
  name: 'coordinates',
  pretty_name: 'Coordinates',

  init: function(options) {
    Portlet.prototype.init.call(this, options);
    this.bindFrame('asserv_tm_xya', function(params) {
      var tds = this.content.find('td');
      $(tds[0]).text(params.x.toFixedHtml(0));
      $(tds[1]).text(params.y.toFixedHtml(0));
      $(tds[2]).text(params.a.toFixedHtml(2));
      $(tds[3]).text(params.vx.toFixedHtml(0));
      $(tds[4]).text(params.vy.toFixedHtml(0));
      $(tds[5]).text(params.omega.toFixedHtml(2));
    });
  },
});


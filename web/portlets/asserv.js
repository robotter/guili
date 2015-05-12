
Portlet.register({
  name: 'asserv',
  pretty_name: 'Asserv',

  init: function(options) {
    Portlet.prototype.init.call(this, options);
    this.bindFrame('asserv_tm_xya', function(params) {
      var tds = this.content.find('td');
      $(tds[0]).text(params.x.toFixedHtml(0));
      $(tds[1]).text(params.y.toFixedHtml(0));
      $(tds[2]).text(params.a.toFixedHtml(2));
    });
    this.bindFrame('asserv_tm_htraj_carrot_xy', function(params) {
      var tds = this.content.find('td');
      $(tds[3]).text(params.x.toFixedHtml(0));
      $(tds[4]).text(params.y.toFixedHtml(0));
    });
    this.bindFrame('asserv_tm_htraj_done', function(params) {
      var tds = this.content.find('td');
      $(tds[0]).toggleClass('portlet-asserv-done', params.xy);
      $(tds[1]).toggleClass('portlet-asserv-done', params.xy);
      $(tds[2]).toggleClass('portlet-asserv-done', params.a);
    });
    this.bindFrame('asserv_tm_htraj_path_index', function(params) {
      var tds = this.content.find('td');
      $(tds[5]).text(params.i + " / " + params.size);
    });

    var self = this;
    $(document).on('field-point-xy', function(ev, x, y) {
      var tds = self.content.find('td');
      $(tds[6]).text(x.toFixedHtml(0));
      $(tds[7]).text(y.toFixedHtml(0));
    });
  },
});


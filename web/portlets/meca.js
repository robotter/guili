
Portlet.register({
  name: 'meca',
  pretty_name: 'Meca',

  init: function(options) {
    Portlet.prototype.init.call(this, options);
    this.bindFrame('meca_tm_arm', function(params) {
      var tds = this.content.find('td');
      $(tds[0]).text(params.upper.toFixedHtml(0));
      $(tds[1]).text(params.elbow.toFixedHtml(0));
      $(tds[2]).text(params.wrist.toFixedHtml(0));
    });
    this.bindFrame('meca_tm_suckers', function(params) {
      var tds = this.content.find('td');
      if(params.a) {
        $(tds[3]).find('i').switchClass('fa-question fa-circle-thin', 'fa-circle');
      } else {
        $(tds[3]).find('i').switchClass('fa-question fa-circle', 'fa-circle-thin');
      }
      if(params.b) {
        $(tds[4]).find('i').switchClass('fa-question fa-circle-thin', 'fa-circle');
      } else {
        $(tds[4]).find('i').switchClass('fa-question fa-circle', 'fa-circle-thin');
      }
    });
  },
});


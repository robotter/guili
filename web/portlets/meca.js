Portlet.register({
  name: 'meca',
  pretty_name: 'Meca',

  init: function(options) {
    Portlet.prototype.init.call(this, options);

    var state_to_color = {
      busy: 'red',
      ready: 'green',
      ground_clear: 'orange',
    };

    var self = this;
    function tm_elevator_cb(side, params) {
      var tds = self.content.find('tr.meca-elevator-'+side+' td');
      $(tds[0]).find('i').css('color', state_to_color[params.state]);
      $(tds[1]).text(params.nb_spots);
    }
    this.bindFrame('meca_tm_left_elevator', function(params) {
      tm_elevator_cb('left', params)
    });
    this.bindFrame('meca_tm_right_elevator', function(params) {
      tm_elevator_cb('right', params)
    });
  },
});


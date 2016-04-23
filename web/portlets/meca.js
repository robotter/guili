Portlet.register({
  name: 'meca',
  pretty_name: 'Meca',

  init: function(options) {
    Portlet.prototype.init.call(this, options);

    this.setRobotViewMenu(gs.robots, this.setRobot.bind(this));
    this.setRobot(options.robot ? options.robot : gs.robots[0]);
  },

  setRobot: function(robot) {
    this.unbindFrame();
    this.robot = robot;
    if(robot) {
      this.content.find('div.portlet-title').text("Meca › "+robot);
    }

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
    this.bindFrame(null, 'meca_tm_left_elevator', function(robot, params) {
      tm_elevator_cb('left', params)
    });
    this.bindFrame(null, 'meca_tm_right_elevator', function(robot, params) {
      tm_elevator_cb('right', params)
    });
  },

  getOptions: function() {
    var options = Portlet.prototype.getOptions.call(this);
    options.robot = this.robot;
    return options;
  },

});



Portlet.register({
  name: 'asserv',
  pretty_name: 'Asserv',

  init: function(options) {
    Portlet.prototype.init.call(this, options);

    this.setRobotViewMenu(gs.robots, this.setRobot.bind(this));
    this.setRobot(options.robot ? options.robot : gs.robots[0]);

    var self = this;
    $(document).on('field-point-xy', function(ev, x, y) {
      var tds = self.content.find('td');
      $(tds[6]).text(x.toFixedHtml(0));
      $(tds[7]).text(y.toFixedHtml(0));
    });
  },

  setRobot: function(robot) {
    this.unbindFrame();
    this.robot = robot;
    if(robot) {
      this.content.find('div.portlet-title').text("Asserv › "+robot);
    }

    this.bindFrame(robot, 'asserv_tm_xya', function(robot, params) {
      var tds = this.content.find('td');
      $(tds[0]).text(params.x.toFixedHtml(0));
      $(tds[1]).text(params.y.toFixedHtml(0));
      $(tds[2]).text(params.a.toFixedHtml(2));
    });
    this.bindFrame(robot, 'asserv_tm_htraj_carrot_xy', function(robot, params) {
      var tds = this.content.find('td');
      $(tds[3]).text(params.x.toFixedHtml(0));
      $(tds[4]).text(params.y.toFixedHtml(0));
    });
    this.bindFrame(robot, 'asserv_tm_htraj_done', function(robot, params) {
      var tds = this.content.find('td');
      $(tds[0]).toggleClass('portlet-asserv-done', params.xy);
      $(tds[1]).toggleClass('portlet-asserv-done', params.xy);
      $(tds[2]).toggleClass('portlet-asserv-done', params.a);
    });
    this.bindFrame(robot, 'asserv_tm_htraj_path_index', function(robot, params) {
      var tds = this.content.find('td');
      $(tds[5]).text(params.i + " / " + params.size);
    });
    this.bindFrame(robot, 'asserv_tm_match_timer', function(robot, params) {
      var tds = this.content.find('td');
      $(tds[8]).text(params.seconds + 's');
    });
  },

  getOptions: function() {
    var options = Portlet.prototype.getOptions.call(this);
    options.robot = this.robot;
    return options;
  },

});


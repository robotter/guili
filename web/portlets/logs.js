
Portlet.register({
  name: 'logs',
  pretty_name: 'Logs',

  init: function(options) {
    Portlet.prototype.init.call(this, options);
    var self = this;
    self.robot = options.robot
    self.robot_tags = {'galipeur': 'G', 'galipette': 'g'}

    // init HTML
    this.node.css('width', '300px');
    this.node.css('height', '200px');
    this.node.resizable({ containment: 'parent', minWidth: 100, minHeight: 40 });

    this.backlog = $(this.content.find('div.portlet-code')[0]);
    this.backlog_size = options.backlog_size ? options.backlog_size : 5000;

    this.bindFrame(null, 'log', function(robot, params) {
      if(self.robot && self.robot != robot) {
        return;
      }
      var entry = $('<div class="portlet-logs-entry" />').appendTo(self.backlog);
      var date = new Date();
      var str_date = ("0"+date.getHours()).slice(-2) +
        ':' + ("0"+date.getMinutes()).slice(-2) +
        ':' + ("0"+date.getSeconds()).slice(-2) +
        '.' + ("00"+date.getMilliseconds()).slice(-3);
      var tag = '';
      if(self.robot_tags[robot]) {
        tag = '<span class="log-tag">' + self.robot_tags[robot] + '</span>';
      }
      entry.append('<span class="log-date">'+str_date+'</span>'+tag+'<span class="log-msg">'+params.msg+'</span>');
      entry.addClass('log-'+params.sev);

      var nremove = self.backlog.children().length - self.backlog_size;
      if(nremove > 0) {
        self.backlog.children(':lt('+nremove+')').remove();
      }
      self.backlog.scrollTop(self.backlog[0].scrollHeight);
    });

    // create the clean icon
    $('<i class="fa fa-trash-o" />').prependTo(this.header).click(function() {
      self.backlog.empty();
    });

    this.setRobotViewMenu(gs.robots.concat([null]), function(robot) { self.robot = robot; });
  },

  getOptions: function() {
    var options = Portlet.prototype.getOptions.call(this);
    options.robot = this.robot;
    return options;
  },

});


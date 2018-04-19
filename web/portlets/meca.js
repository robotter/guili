Portlet.register({
  name: 'meca',
  pretty_name: 'Meca',

  init: function(options) {
    Portlet.prototype.init.call(this, options);
    this.node.css('width', '200px');
    this.node.resizable({ containment: 'parent', aspectRatio: true, minWidth: 100 });

    // wait for the SVG document to be loaded before using it
    var self = this;
    var df = $.Deferred();
    var object = this.content.children('object')[0];
    object.onload = function() {
      var svg = object.getSVGDocument()
      self.cylinder = svg.getElementById('cylinder');
      self.state = svg.getElementById('state')
      self.emptying_move = svg.getElementById('emptying_move')
      self.rotate_cylinder = svg.getElementById('rotate-cylinder')
      self.last_angle = 0;

      self.bindFrame(null, 'meca_tm_cylinder_state', function(robot, params) {
        for(var i=0; i<params.color.length; ++i) {
          svg.getElementById('slot-'+i).setAttribute('class', 'slot color-'+params.color[i]);
        }
      });
      self.bindFrame(null, 'meca_tm_cylinder_position', function(robot, params) {
        var angle = params.a * 180 / Math.PI;
        if(angle == self.last_angle) {
          return;
        }
        var da = Math.abs(angle - self.last_angle);
        self.rotate_cylinder.setAttribute('from', self.last_angle);
        self.rotate_cylinder.setAttribute('dur', (da / 300)+'s');
        self.rotate_cylinder.setAttribute('to', angle);
        self.rotate_cylinder.beginElement();
        self.last_angle = angle;
      });
      self.bindFrame(null, 'meca_tm_state', function(robot, params) {
        self.state.setAttribute('class', params.state);
      });
      self.bindFrame(null, 'meca_tm_optimal_emptying_move', function(robot, params) {
        self.emptying_move.setAttribute('class', params.move);
      });
      df.resolve();
    };

    return df.promise();
  },
});


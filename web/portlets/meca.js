Portlet.register({
  name: 'meca',
  pretty_name: 'Meca',

  init: function(options) {
    Portlet.prototype.init.call(this, options);
    this.node.css('width', '200px');
    this.node.resizable({ containment: 'parent', aspectRatio: true, minWidth: 100 });
    var cylinder = document.getElementById("cylinder");

    // wait for the SVG document to be loaded before using it
    var self = this;
    var df = $.Deferred();
    var object = this.content.children('object')[0];
    object.onload = function() {
      self.cylinder = object.getSVGDocument().getElementById('cylinder');
      self.state = object.getSVGDocument().getElementById('state')
      self.emptying_move = object.getSVGDocument().getElementById('emptying_move')

      self.bindFrame(null, 'meca_tm_cylinder_state', function(robot, params) {
        for(var i=0; i<params.color.length; ++i) {
          self.cylinder.getElementById('slot-'+i).setAttribute('class', 'slot color-'+params.color[i]);
        }
      });
      self.bindFrame(null, 'meca_tm_cylinder_position', function(robot, params) {
        self.cylinder.setAttribute('transform', "rotate("+(params.a*180/Math.PI)+")");
      });
      self.bindFrame(null, 'meca_tm_state', function(robot, params) {
        self.state.setAttribute('class', params.state);
      });
      self.bindFrame(null, 'meca_tm_optimal_emptying_move', function(robot, params) {
        self.emptying_move.setAttribute('class', params.emptying_move);
      });
    };

    return df.promise();
  },
});


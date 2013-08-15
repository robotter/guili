
Portlet.register({
  name: 'field',
  pretty_name: 'Field',

  init: function(options) {
    Portlet.prototype.init.call(this, options);
    this.node.css('width', '200px');
    this.node.resizable({ containment: 'parent', aspectRatio: true, minWidth: 100 });

    // wait for the SVG document to be loaded before using it
    var self = this;
    var df = $.Deferred();
    var object = this.content.children('object')[0];
    object.onload = function() {
      var field = object.getSVGDocument().getElementById('drawing');
      // create SVG robot
      var svg_robot = field.createElement('use');
      svg_robot.setAttributes({
        'id': 'robot',
        'xlink:href': '#reflector',
      });
      field.appendChild(svg_robot);
      // create a marker for velocity vectors
      var marker = field.getElementById('marker-vector-arrow').cloneNode(true);
      marker.setAttributes({
        'id': 'marker-vector-velocity',
        'stroke': 'blue',
        'stroke-width': 1,
      });
      field.getElementById('defs').appendChild(marker);
      // create SVG robot's velocity vector
      var svg_velocity = field.createElement('line');
      svg_velocity.setAttributes({
        'id': 'robot-velocity',
        'stroke': 'blue',
        'stroke-width': 5,
        'marker-end': 'url(#marker-vector-velocity)',
      });
      field.appendChild(svg_velocity);

      // set portlet properties
      self.field = field;
      self.svg_robot = svg_robot;
      self.svg_velocity = svg_velocity;

      df.resolve();
    };
    return df.promise();
  },

  update: function(data) {
    this.svg_robot.setAttributes({
      'transform': "translate("+data.robot.x+","+data.robot.y+")",
    });

    this.svg_velocity.setAttributes({
      'x1': data.robot.x, 'y1': data.robot.y,
      'x2': data.robot.x + data.robot.vx, 'y2': data.robot.y + data.robot.vy,
    });
  },

});



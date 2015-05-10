
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
      // explicitely initialize object height, webkit does not compute it
      // according to SVG viewBox ratio
      var viewBox = field.viewBox.baseVal;
      self.node.height(self.node.width() * viewBox.height / viewBox.width);

      // create SVG robot
      var svg_robot = field.createElement('use');
      svg_robot.setAttributes({
        'id': 'galipeur',
        'xlink:href': '#def-galipeur',
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

      self.bindFrame('asserv_tm_xya', self.updatePosition);

      df.resolve();
    };

    return df.promise();
  },

  updatePosition: function(params) {
    this.svg_robot.setAttributes({
      'transform': "translate("+params.x+","+params.y+")",
    });

    this.svg_velocity.setAttributes({
      'x1': params.x, 'y1': params.y,
      'x2': params.x + 100, 'y2': params.y + 100,
    });
  },

});



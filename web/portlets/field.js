
Portlet.register({
  name: 'field',
  pretty_name: 'Field',

  init: function(options) {
    Portlet.prototype.init.call(this, options);
    this.node.css('width', '200px');
    this.node.resizable({ containment: 'parent', aspectRatio: true, minWidth: 100 });
    this.svg_robots = {};
    this.svg_carrots = {};
    this.pathfindings = {};

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
      var frame = field.getElementById('reference-frame');

      // set portlet properties
      self.field = field;
      self.frame = frame;

      // create SVG robots and carrots
      self.initSvgElements(gs.robots);

      // send event when clicking on field
      $(field).on('mousedown', function(ev) {
        // get drawing position from mouse position
        var pos = field.createSVGPoint();
        pos.x = ev.clientX;
        pos.y = ev.clientY;
        pos = pos.matrixTransform(frame.getScreenCTM().inverse());
        // send event
        $.event.trigger('field-point-xy', [pos.x, pos.y]);
      });

      self.bindFrame(null, 'asserv_tm_xya', self.updatePosition);
      self.bindFrame(null, 'asserv_tm_htraj_carrot_xy', function(robot, params) {
        self.svg_carrots[robot].setAttributes({x: params.x, y: params.y});
      });

      self.bindFrame(null, 'pathfinding_node', function(robot, params) {
        var pf = self.pathfindings[robot];
        // remove node and vertices, if any
        $(pf.svg_nodes).find('.graph-node-'+params.i).remove();
        $(pf.svg_vertices).find('.graph-vertex-'+params.i).remove();
        // create new node
        var node = self.field.createElement('circle');
        node.setAttributes({
          'r': 25, 'cx': params.x, 'cy': params.y,
          'class': 'graph-node graph-node-'+params.i,
        });
        pf.svg_nodes.appendChild(node);
        // create vertices
        params.neighbors.forEach(function(n) {
          var node2 = $(pf.svg_nodes).find('.graph-node-'+n);
          if(node2.size()) {
            var vertex = self.field.createElement('line');
            vertex.setAttributes({
              'class': 'graph-vertex graph-vertex-'+params.i+' graph-vertex-'+n,
              'x1': params.x, 'y1': params.y,
              'x2': node2.attr('cx'), 'y2': node2.attr('cy'),
            });
            pf.svg_vertices.appendChild(vertex);
          }
        });
      });

      self.bindFrame(null, 'pathfinding_path', function(robot, params) {
        var pf = self.pathfindings[robot];
        pf.svg.querySelectorAll('.active').forEach(function(o) { o.classList.remove('active') });
        pf.svg_nodes.querySelectorAll('.start').forEach(function(o) { o.classList.remove('start') });
        pf.svg_nodes.querySelectorAll('.goal').forEach(function(o) { o.classList.remove('goal') });
        for(var i=0; i<params.nodes.length; ++i) {
          var node1 = params.nodes[i];
          pf.svg_nodes.querySelector('.graph-node-'+node1).classList.add('active');
          if(i > 0) {
            var node2 = params.nodes[i-1];
            pf.svg_vertices.querySelector('.graph-vertex-'+node1+'.graph-vertex-'+node2).classList.add('active');
          }
        }
        pf.svg_nodes.querySelector('.graph-node-'+params.nodes[0]).classList.add('start');
        pf.svg_nodes.querySelector('.graph-node-'+params.nodes[params.nodes.length-1]).classList.add('goal');
      });

      df.resolve();
    };
  },

  initSvgElements: function(robots) {
    // remove existing elements
    for(var robot in this.svg_robots) {
      this.frame.removeChild(this.svg_robots[robot]);
    }
    for(var robot in this.svg_carrots) {
      this.frame.removeChild(this.svg_carrots[robot]);
    }
    for(var robot in this.pathfindings) {
      this.frame.removeChild(this.pathfindings[robot].svg);
    }

    var self = this;
    robots.forEach(function(robot, irobot) {
      // create SVG robot
      var svg_robot = self.field.createElement('use');
      var svg_name = normalizeRobotName(robot, irobot);
      if(svg_name != 'galipeur' && svg_name != 'galipette') {
        return;
      }

      svg_robot.setAttributes({
        'xlink:href': '#def-' + svg_name,
        'class': svg_name,
      });
      self.frame.appendChild(svg_robot);

      // create SVG carrot
      var svg_carrot = self.field.createElement('use');
      svg_carrot.setAttributes({
        'xlink:href': '#def-carrot',
        'class': svg_name,
      });
      self.frame.appendChild(svg_carrot);

      // create SVG pathfindings (prepare groups)
      var pathfinding = {
        svg: self.field.createElement('g'),
        svg_vertices: self.field.createElement('g'),
        svg_nodes: self.field.createElement('g'),
      };
      self.frame.appendChild(pathfinding.svg);
      pathfinding.svg.appendChild(pathfinding.svg_vertices);
      pathfinding.svg.appendChild(pathfinding.svg_nodes);

      self.svg_robots[robot] = svg_robot;
      self.svg_carrots[robot] = svg_carrot;
      self.pathfindings[robot] = pathfinding;
    });
  },

  updatePosition: function(robot, params) {
    this.svg_robots[robot].setAttributes({
      'transform': "translate("+params.x+","+params.y+") rotate("+(params.a*180/Math.PI)+")",
    });
  },

});



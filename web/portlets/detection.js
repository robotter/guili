Portlet.register({
  name: 'detection',
  pretty_name: 'Detection',

  init: function(options) {
    Portlet.prototype.init.call(this, options);
    this.node.css('width', '400px');
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

			pings = [];
			for(i=0;i<3;i++) {
	      var svg_ping = field.createElement('circle');
  	    svg_ping.setAttributes({
    	    'class':'ping-red',
      	  'cx':'100', 'cy':'0',
        	'r':'4',
	      });
  	    field.appendChild(svg_ping);
				pings.push(svg_ping);
			}

      arcs = [];
      for(i=0;i<6;i++) {
        var svg_arc = field.createElement('line');
        svg_arc.setAttributes({
          'class':'arc',
          'x1':'0', 'y1':'0',
        });
        field.appendChild(svg_arc);
        arcs.push(svg_arc);
      }

      // set portlet properties
      self.field = field;
      self.svg_pings = pings;
			console.log(self.svg_pings);
      self.svg_arcs = arcs;

      self.bindFrame('r3d2_tm_detection', self.updateDetections);
      self.bindFrame('r3d2_tm_arcs', self.updateArcs);
      df.resolve();
    };

    return df.promise();
  },

  updateDetections: function(params) {
    
    var r = params.r/10.0;

		var radius;

		if(params.r < 0) {
			radius = 40;
			r = 175;
		}
		else {
			radius = 4;
		}

    var x = -r*Math.cos(params.a);
    var y = r*Math.sin(params.a);

		var ping = this.svg_pings[params.i];
    ping.setAttributes({
			'r':radius,
      'cx':x,
      'cy':y,
    });
  },

  updateArcs: function(params) {
    
    arc1 = this.svg_arcs[2*params.i+0];
    arc2 = this.svg_arcs[2*params.i+1];

    var x,y,r = 200;
    x = -r*Math.cos(params.a1);
    y = r*Math.sin(params.a1);
    arc1.setAttributes({'x2':x, 'y2':y});
    x = -r*Math.cos(params.a2);
    y = r*Math.sin(params.a2);
    arc2.setAttributes({'x2':x, 'y2':y});
  }

});




Portlet.register({
  name: 'graph',
  pretty_name: 'Graph',

  default_value_count: 300,

  // predefined graph configurations
  views: [
    {
      name: 'position',
      pretty_name: 'Position',
      frameName: 'asserv_tm_xya',
      series: [
        { label: 'x', getter: function(params) { return params.x; } },
        { label: 'y', getter: function(params) { return params.y; } },
        { label: 'a', yaxis: 2, getter: function(params) { return params.a; } },
      ],
      yaxes: [
        { min: -800., max: 800. },
        { min: -3.2, max: 3.2, position: 'right',
          zoomRange: false,
          panRange: false,
          ticks: [[-Math.PI, '\u2212π'], [-Math.PI/2, '\u2212π/2'], [0, '0'], [Math.PI/2, 'π/2'], [Math.PI, 'π']],
        }
      ],
    },
    {
      name: 'velocity',
      pretty_name: 'Velocity (x/y/a)',
      frameName: 'asserv_tm_xya',
      series: [
        { label: 'vx', getter: function(params) { return params.vx; } },
        { label: 'vy', getter: function(params) { return params.vy; } },
        { label: 'ω', yaxis: 2, getter: function(params) { return params.omega; } },
      ],
      yaxes: [
        { min: -800., max: 800. },
        { min: -Math.PI*2, max: Math.PI*2, position: 'right' },
      ],
    },
  ],


  init: function(options) {
    Portlet.prototype.init.call(this, options);
    this.value_count = options.value_count ? options.value_count : this.default_value_count;
    var self = this;

    // create the view menu
    {
      var icon = $('<i class="fa fa-eye" />').prependTo(this.header);
      var menu = $('<ul class="portlet-header-menu" />').appendTo(this.header);
      for(var i=0; i<this.views.length; ++i) {
        var view = this.views[i];
        var item = $('<li><a href="#"></a></li>').appendTo(menu);
        item.data('name', view.name);
        item.children('a').text(view.pretty_name)
      }

      menu.clickMenu(icon, {
        select: function(ev, ui) {
          self.setView(ui.item.data('name'));
          self.view_menu.hide();
        },
      });
      this.view_menu = menu;
    }

    // create and configure the plot
    var plotdiv = $(this.content.children('div')[0]);
    plotdiv.css('width', '300px');
    plotdiv.css('height', '200px');

    this.node.resizable({
      containment: 'parent', alsoResize: plotdiv,
      minWidth: 100, minHeight: 50,
    });

    // set initial view, also create the plot
    this.setView(options.view ? options.view : this.views[0].name);
  },

  getOptions: function() {
    var options = Portlet.prototype.getOptions.call(this);
    options.view = this.view.name;
    return options;
  },

  updateData: function(params) {
    for(var i=0; i<this.data.length; ++i) {
      var d = this.data[i].data;
      d.push([this.t, this.view.series[i].getter(params)]);
      while(d.length > this.value_count) {
        d.shift();
      }
    }
    this.plot.setData(this.data);

    // update xaxis min/max
    var options = this.plot.getOptions();
    var axis = options.xaxes[0];
    var dx = axis.max - axis.min;
    if(this.t > dx) {
      options.xaxes[0].min = this.t - dx;
      options.xaxes[0].max = this.t;
      this.plot.setupGrid();
    }
    this.plot.draw();
    this.t++;
  },

  setView: function(name) {
    var view;
    for(var i=0; i<this.views.length; ++i) {
      view = this.views[i];
      if(view.name == name) {
        break;
      }
    }
    if(!view) {
      console.error("unknown graph view: "+name);
      return;
    }
    if(this.view === view) {
      return;  // no change, nothing to do
    }
    this.view = view;

    // initialize data
    this.t = 0;
    this.data = view.series.map(function(o) {
      return { label: o.label, yaxis: o.yaxis, data: [] };
    });

    // create the plot
    var options = {
      series: {
        lines: { show: true },
        points: { show: false },
        shadowSize: 0,
      },
      legend: { position: 'nw' },
      xaxis: {
        zoomRange: false,
        panRange: false,
        min: 0, max: this.value_count-1,
      },
			zoom: { interactive: true },
			pan: { interactive: true },
      yaxes: view.yaxes,
    };

    this.plot = $.plot($(this.content.children('div')[0]), this.data, options);
    this.plot.draw();
    var options = this.plot.getOptions();

    // register new frame handlers
    this.unbindFrame();
    this.bindFrame(view.frameName, this.updateData);
  },

});



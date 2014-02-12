
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
      ],
      yaxis: { min: -800., max: 800. },
    },
    {
      name: 'velocity',
      pretty_name: 'Velocity',
      frameName: 'asserv_tm_xya',
      series: [
        { label: 'vx', getter: function(params) { return params.vx; } },
        { label: 'vy', getter: function(params) { return params.vy; } },
      ],
      yaxis: { min: -800., max: 800. },
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

    this.plot = $.plot(plotdiv, [], {
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
      yaxis: {},
			zoom: { interactive: true },
			pan: { interactive: true },
    });

    this.node.resizable({
      containment: 'parent', alsoResize: plotdiv,
      minWidth: 100, minHeight: 50,
    });

    // set initial view
    this.setView(options.view ? options.view : this.views[0].name);
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
    // unregister previous handlers
    this.unbindFrame();

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

    this.t = 0;
    this.data = view.series.map(function(o) {
      return { label: o.label, data: [] };
    });
    var options = this.plot.getOptions();
    $.extend(options.yaxes[0], view.yaxis);

    this.plot.setData(this.data);
    this.plot.setupGrid();
    this.plot.draw();

    // register new frame handler
    this.bindFrame(view.frameName, this.updateData);
  },

});



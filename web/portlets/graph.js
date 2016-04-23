
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
        { min: -1500., max: 1500. },
        { min: -3.2, max: 3.2, position: 'right',
          zoomRange: false,
          panRange: false,
          ticks: [[-Math.PI, '\u2212π'], [-Math.PI/2, '\u2212π/2'], [0, '0'], [Math.PI/2, 'π/2'], [Math.PI, 'π']],
        }
      ],
    },
    {
      name: 'arm',
      pretty_name: 'Arm',
      frameName: 'meca_tm_arm',
      series: [
        { label: 's', getter: function(params) { return params.upper; }, yaxis: 2 },
        { label: 'e', getter: function(params) { return params.elbow; } },
        { label: 'w', getter: function(params) { return params.wrist; } },
      ],
      yaxes: [
        { min: -0x210, max: 0x210 },
        { min: -13000, max: 13000, position: 'right' },
      ],
    },
  ],


  init: function(options) {
    // set default portlet size
    options.position = $.extend({ w: 300, h: 200 }, options.position);

    Portlet.prototype.init.call(this, options);
    this.value_count = options.value_count ? options.value_count : this.default_value_count;

    this.initViewMenu(gs.robots);

    // create and configure the plot
    var plotdiv = $(this.content.children('div')[0]);
    plotdiv.css('width', options.position.w+'px');
    plotdiv.css('height', options.position.h+'px');

    this.node.resizable({
      containment: 'parent', alsoResize: plotdiv,
      minWidth: 100, minHeight: 50,
    });

    // set initial view, also create the plot
    this.setView(options.robot ? options.robot : gs.robots[0], options.view ? options.view : this.views[0].name);
  },

  initViewMenu: function(robots) {
    var self = this;

    this.header.find('.view-menu').remove();
    var icon = $('<i class="fa fa-eye view-menu" />').prependTo(this.header);
    var menu = $('<ul class="portlet-header-menu view-menu" />').appendTo(this.header);
    robots.forEach(function(robot) {
      self.views.forEach(function(view) {
        var item = $('<li><a href="#"></a></li>').appendTo(menu);
        item.data('robot', robot);
        item.data('name', view.name);
        item.children('a').text(robot + " › " + view.pretty_name)
      });
    });

    menu.clickMenu(icon, {
      select: function(ev, ui) {
        self.setView(ui.item.data('robot'), ui.item.data('name'));
        self.view_menu.hide();
      },
    });
    this.view_menu = menu;
  },

  getOptions: function() {
    var options = Portlet.prototype.getOptions.call(this);
    options.view = this.view.name;
    options.robot = this.view_robot;
    return options;
  },

  updateData: function(robot, params) {
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

  setView: function(robot, name) {
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
    if(this.view_robot == robot && this.view === view) {
      return;  // no change, nothing to do
    }
    this.view_robot = robot;
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
    this.bindFrame(robot, view.frameName, this.updateData);
  },

});




Portlet.register({
  name: 'coordinates',
  pretty_name: 'Coordinates',

  update: function(data) {
    var tds = this.content.find('td');
    $(tds[0]).text(data.robot.x.toFixedHtml(0));
    $(tds[1]).text(data.robot.y.toFixedHtml(0));
    $(tds[2]).text(data.robot.vx.toFixedHtml(0));
    $(tds[3]).text(data.robot.vy.toFixedHtml(0));
    $(tds[4]).text(data.robot.ax.toFixedHtml(0));
    $(tds[5]).text(data.robot.ay.toFixedHtml(0));
  },
});


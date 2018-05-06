
Portlet.register({
  name: 'match',
  pretty_name: 'Match',

  init: function(options) {
    Portlet.prototype.init.call(this, options);

    var tbody = this.content.find('tbody');
    this.timer = tbody.find('th');

    var scores = {};
    gs.robots.forEach(function(r) {
      var tr = $('<tr></tr>');
      $('<td></td>').text(r).appendTo(tr);
      scores[r] = $('<td class="data-number">? pts</td>').appendTo(tr);
      tr.appendTo(tbody);
    });
    this.scores = scores;

    this.bindFrame(null, 'tm_match_timer', function(robot, params) {
      this.updateTimer(params.seconds);
    });
    this.bindFrame(null, 'tm_score', function(robot, params) {
      this.scores[robot].text(params.points + ' pts');
    });
  },

  updateTimer: function(t) {
    this.timer.text(t + ' s');
  }

});



Portlet.register('match', 'Match', class extends Portlet {

  async init(options) {
    await super.init(options);

    const tbody = this.content.querySelector('tbody');
    this.timer = tbody.querySelector('th');

    this.scores = {};
    for(const r of gs.robots) {
      if(normalizeRobotName(r) == 'boomotter') {
        return;
      }
      const tr = document.createElement('tr');
      const td_r = document.createElement('td');
      td_r.textContent = r;
      tr.appendChild(td_r);
      const td_score = createElementFromHtml('<td class="data-number">? pts</td>');
      tr.appendChild(td_score);
      this.scores[r] = td_score;
      tbody.appendChild(tr);
    }

    this.bindFrame(null, 'tm_match_timer', (robot, params) => {
      this.updateTimer(params.seconds);
    });
    this.bindFrame(null, 'tm_score', (robot, params) => {
      this.scores[robot].text(params.points + ' pts');
    });
  }

  updateTimer(t) {
    this.timer.textContent = t + ' s';
  }

});


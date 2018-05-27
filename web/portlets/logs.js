
Portlet.register('logs', 'Logs', class extends Portlet {

  async init(options) {
    await super.init(options);
    this.robot = options.robot
    this.robot_tags = {'galipeur': 'G', 'galipette': 'g'}

    // init HTML
    this.node.style.width = '300px';
    this.node.style.height = '200px';
    this.enableResize({ min_w: 100, min_h: 40 });

    this.backlog = this.content.querySelector('div.portlet-code');
    this.backlog_size = options.backlog_size ? options.backlog_size : 5000;

    this.bindFrame(null, 'log', (robot, params) => {
      if(this.robot && this.robot != robot) {
        return;
      }
      const entry = createElementFromHtml('<div class="portlet-logs-entry" />');
      const date = new Date();
      const s_hour = date.getHours().toString().padStart(2, '0');
      const s_min = date.getMinutes().toString().padStart(2, '0');
      const s_sec = date.getSeconds().toString().padStart(2, '0');
      const s_ms = date.getMilliseconds().toString().padStart(3, '0');
      const str_date = `${s_hour}:${s_min}:${s_sec}.${s_ms}`;
      let tag = '';
      if(this.robot_tags[robot]) {
        tag = '<span class="log-tag">' + this.robot_tags[robot] + '</span>';
      }
      entry.innerHTML = '<span class="log-date">'+str_date+'</span>'+tag+'<span class="log-msg">'+params.msg+'</span>';
      entry.classList.add('log-'+params.sev);
      this.backlog.appendChild(entry);

      while(this.backlog.childNodes.length > this.backlog_size) {
        this.backlog.childNodes[0].remove();
      }
      this.backlog.scrollTop = this.backlog.scrollHeight;
    });

    const clean_icon = createElementFromHtml('<i class="fa fa-trash-o" />');
    this.header.insertBefore(clean_icon, this.header.childNodes[0]);
    clean_icon.addEventListener('click', () => { this.backlog.innerHTML = ''; });
    this.setRobotViewMenu(gs.robots.concat([null]), robot => { this.robot = robot; });
  }

  getOptions() {
    return Object.assign(super.getOptions(), {
      robot: this.robot,
    });
  }

});


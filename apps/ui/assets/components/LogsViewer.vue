<template>
  <div class="x-container">
    <pre class="bg-dark text-white log-viewer" ref="scroller"
    ><div v-for="(item, idx) of logs" :key="idx" :class="{'text-danger': 'error' === item.level}"
    ><span>[{{dateStr(item.timestamp)}}]</span
    > <span v-html="getLink(item.filename)"></span
    > <span>{{item.message}}</span
    ></div>
    </pre>
  </div>
</template>

<script>
import {UtilsMixin} from './UtilsMixin.mjs';

const Prism = window['Prism'];
Prism.manual = true;

export default {
  mixins: [UtilsMixin],
  data() {
    return {
      interval: null,
      logs: []
    };
  },
  methods: {
    async fetch(from) {
      const response = await fetch(`/api/logs/${this.driveId}?from=` + from);
      const logs = await response.json();
      const firstLog = logs.length > 0 ? logs[0] : null;
      if (firstLog) {
        this.logs = this.logs.filter(row => row.timestamp < firstLog.timestamp);
      }

      const oldScrollTop = this.$refs.scroller.scrollHeight - this.$refs.scroller.offsetHeight - 20;
      this.logs.push(...logs);
      if (this.$refs.scroller.scrollTop > oldScrollTop) {
        this.$nextTick(() => {
          this.$refs.scroller.scrollTop = this.$refs.scroller.scrollHeight - this.$refs.scroller.offsetHeight;
        });
      }
    },
    getLink(fileName) {
      if (!fileName) {
        return '';
      }
      const [path, line] = fileName.split(':');
      const branch = window.location.hostname === 'wikigdrive.com' ? 'master' : 'develop';
      const url = `https://github.com/mieweb/wikiGDrive/blob/${branch}/${path}#L${line}`;
      let baseName = path.split('/').pop();
      return `<a target="github" href="${url}">${baseName}</a>`;
    },
    dateStr(v) {
      return new Date(v).toISOString();
    }
  },
  async mounted() {
    this.interval = setInterval(() => {
      const lastLog = this.logs.length > 0 ? this.logs[this.logs.length - 1] : null;
      this.fetch(lastLog?.timestamp || 0);
    }, 2000);
    await this.fetch(0);
    // Prism.highlightElement(this.$refs.code);
  },
  beforeUnmount() {
    clearInterval(this.interval);
  }
};
</script>

<template>
  <div class="x-container mainbar__content-height">
    <StatusToolBar :active-tab="activeTab">
    </StatusToolBar>

    <div class="btn-toolbar">
      <div class="flex-grow-1"></div>
      <button class="btn btn-sm" @click="errorsOnly = !errorsOnly">{{ errorsOnly ? 'Show all logs' : 'Show errors only' }}</button>
    </div>

    <pre class="bg-dark text-white log-viewer overflow-auto"
    ><div v-for="(item, idx) of logsFiltered" :key="idx" :class="{'text-danger': 'error' === item.level, 'text-warning': 'warn' === item.level}"
    ><span>[{{dateStr(item.timestamp)}}]</span
    > <span v-html="getLink(item.filename)"></span
    > <span v-html="highLight(item.message)"></span
    ></div>
  </pre>
  </div>
</template>

<script>
import {UtilsMixin} from './UtilsMixin.ts';
import StatusToolBar from './StatusToolBar.vue';

export default {
  mixins: [UtilsMixin],
  components: {StatusToolBar},
  props: {
    activeTab: {
      type: String
    },
    jobId: {
      type: String
    },
    contentDir: {
      type: String
    },
    autoRefresh: {
      type: Boolean
    }
  },
  data() {
    return {
      errorsOnly: false,
      logs: [],
      intervalHandle: null
    };
  },
  computed: {
    currentJob() {
      return this.$root.jobs.find(job => 'job-' + job.id === this.jobId);
    },
    absPath() {
      return '/drive/' + this.driveId + this.contentDir;
    },
    logsFiltered() {
      let retVal = this.logs;
      if (this.errorsOnly) {
        retVal = retVal.filter(item => ['error', 'warn'].includes(item.level));
      }
      return retVal;
    }
  },
  methods: {
    async fetch() {
      if (!this.jobId || !this.jobId.startsWith('job-')) {
        return;
      }
      const jobId = this.jobId.substring('job-'.length);

      const response = await this.authenticatedClient.fetchApi(`/api/logs/${this.driveId}?order=asc&jobId=` + (jobId) + '&offset=' + this.logs.length);
      const logs = await response.json();

      if (this.intervalHandle && this.currentJob && this.currentJob.finished) {
        clearInterval(this.intervalHandle);
        this.intervalHandle = null;
      }

      if (logs.length === 0) {
        return;
      }

      this.logs = this.logs.concat(logs);

      if (logs.length > 0) {
        this.handleScroll();
      }
    },
    handleScroll() {
      const scroller = document.querySelector('.mainbar__content-height > pre');
      if (scroller) {
        const oldScrollTop = scroller.scrollHeight - scroller.offsetHeight - 10;
        if (scroller.scrollTop < oldScrollTop) {
          this.$nextTick(() => {
            const scroller = document.querySelector('.mainbar__content-height > pre');
            if (scroller) {
              scroller.scrollTop = scroller.scrollHeight - scroller.offsetHeight;
            }
          });
        }
      }
      this.$nextTick(() => {
        this.rewriteLinks();
      });
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
      if (!v) {
        return '';
      }
      return new Date(v).toISOString();
    },
    highLight(str) {
      return str;
      // FIXME: return Prism.highlight(str, Prism.languages.markdown, 'markdown');
    },
    rewriteLinks() {
      const links = this.$el.querySelectorAll('a[data-to-rewrite]');
      for (const link of links) {
        const href = link.getAttribute('href');
        if (href.endsWith('.md')) {
          link.setAttribute('href', this.absPath + '/' + href + '#markdown');
          link.addEventListener('click', event => {
            event.preventDefault();
            this.$router.push(link.getAttribute('href'));
          });
        } else
        if (href.endsWith('.svg')) {
          link.setAttribute('href', this.absPath + '/' + href);
          link.addEventListener('click', event => {
            event.preventDefault();
            this.$router.push(link.getAttribute('href'));
          });
        }
        link.removeAttribute('data-to-rewrite');
      }
    }
  },
  async mounted() {
    await this.fetch();

    this.handleScroll();
    // Prism.highlightElement(this.$refs.code);
    if (!this.intervalHandle && this.currentJob && !this.currentJob.finished) {
      this.intervalHandle = setInterval(() => {
        this.fetch();
      }, 1000);
    }
  },
  beforeUnmount() {
    if (!this.intervalHandle) {
      return;
    }
    clearInterval(this.intervalHandle);
    this.intervalHandle = null;
  }
};
</script>

<template>
  <div class="x-container mainbar__content-height">
    <StatusToolBar :active-tab="activeTab">
    </StatusToolBar>

    <div class="btn-toolbar">
      <button class="btn btn-sm" @click="showOlder">Show older than {{dateStr(innerValue.from)}}</button>
      <div class="flex-grow-1"></div>
      <button class="btn btn-sm" @click="errorsOnly = !errorsOnly">{{ errorsOnly ? 'Show all logs' : 'Show errors only' }}</button>
      <button class="btn btn-sm" @click="clearConsole">Clear console</button>
    </div>

    <pre class="bg-dark text-white log-viewer overflow-auto"
    ><div v-for="(item, idx) of logsFiltered" :key="idx" :class="{'text-danger': 'error' === item.level}"
    ><span>[{{dateStr(item.timestamp)}}]</span
    > <span v-html="getLink(item.filename)"></span
    > <span>{{item.message}}</span
    ></div>
  </pre>
  </div>
</template>

<script>
import {UtilsMixin} from './UtilsMixin.mjs';
import StatusToolBar from './StatusToolBar.vue';

const Prism = window['Prism'];
Prism.manual = true;

export default {
  mixins: [UtilsMixin],
  components: {StatusToolBar},
  emits: ['update:modelValue'],
  props: {
    modelValue: {
      type: Object
    },
    activeTab: {
      type: String
    }
  },
  data() {
    return {
      errorsOnly: false,
      interval: null,
      logs: [],
      innerValue: {
        from: 0,
        until: 0
      },
    };
  },
  watch: {
    modelValue: {
      deep: true,
      handler() {
        this.innerValue = {...this.modelValue};
      }
    }
  },
  created() {
    this.innerValue = {...this.modelValue};
  },
  computed: {
    logsFiltered() {
      let retVal = this.logs;
      if (this.errorsOnly) {
        retVal = retVal.filter(item => 'error' === item.level);
      }
      if (this.innerValue.from > 0) {
        retVal = retVal.filter(item =>  item.timestamp > this.innerValue.from);
      }
      if (this.innerValue.to > 0) {
        retVal = retVal.filter(item =>  item.timestamp < this.innerValue.to);
      }
      return retVal;
    }
  },
  methods: {
    async showOlder() {
      await this.fetchOlder();
    },
    clearConsole() {
      const lastLog = this.logs.length > 0 ? this.logs[this.logs.length - 1] : null;
      this.innerValue.from = lastLog?.timestamp || +new Date();
      this.$emit('update:modelValue', this.innerValue);
      this.logs = [];
    },
    async fetchOlder() {
      const until = this.innerValue.from || +new Date();
      const response = await this.authenticatedClient.fetchApi(`/api/logs/${this.driveId}?order=desc&until=` + (until - 1));
      const logs = await response.json();
      if (logs.length === 0) {
        return;
      }

      logs.sort((a, b) => (a?.timestamp || 0) - (b?.timestamp || 0));

      const firstFetch = this.logs.length === 0;

      this.logs.unshift(...logs);

      this.innerValue.from = logs[0].timestamp;
      this.$emit('update:modelValue', this.innerValue);

      this.$nextTick(() => {
        const scroller = document.querySelector('.mainbar__content-height > pre');
        if (scroller) {
          scroller.scrollTop = 0;
        }
      });
    },
    async fetchNewer() {
      const from = this.innerValue.to || +new Date();
      const response = await this.authenticatedClient.fetchApi(`/api/logs/${this.driveId}?order=asc&from=` + (from + 1));
      const logs = await response.json();
      if (logs.length === 0) {
        return;
      }

      logs.sort((a, b) => (a?.timestamp || 0) - (b?.timestamp || 0));

      this.logs.push(...logs);

      this.innerValue.to = logs[logs.length - 1].timestamp;
      this.$emit('update:modelValue', this.innerValue);

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
      this.fetchNewer();
    }, 2000);
    await this.fetchOlder();

    if (this.logs.length > 0) {
      this.innerValue.to = this.logs[this.logs.length - 1].timestamp;
    }

    this.handleScroll();
    // Prism.highlightElement(this.$refs.code);
  },
  beforeUnmount() {
    clearInterval(this.interval);
  }
};
</script>

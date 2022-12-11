<template>
  <div class="x-container mainbar__content-height">
    <StatusToolBar :active-tab="activeTab">
    </StatusToolBar>

    <div class="btn-toolbar">
      <button class="btn btn-sm" @click="fetch"><i class="fa-solid fa-rotate"></i> Refresh</button>
    </div>

    <div>
      <table class="table table-bordered jobs-list">
        <thead>
        <tr>
          <th></th>
          <th>Started</th>
          <th>Duration</th>
          <th>Trace</th>
          <th>Spans</th>
          <th>Name</th>
        </tr>
        </thead>
        <tbody>
          <tr v-for="trace in tracesFlatten" :key="trace.traceId">
            <td>{{ trace.kind }}</td>
            <td>{{ dateStr(trace.timestamp / 1000) }}</td>
            <td class="text-end">{{ trace.duration / 1000 }}ms</td>
            <td><a target="zipkin" :href="ZIPKIN_URL + '/traces/' + trace.traceId">{{ trace.traceId }}</a></td>
            <td class="text-end">{{ trace.spans.length }}</td>
            <td>{{ trace.name }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import {UtilsMixin} from './UtilsMixin.ts';
import StatusToolBar from './StatusToolBar.vue';

const metaEl = document.querySelector('meta[name=ZIPKIN_URL]');
const ZIPKIN_URL = metaEl ? metaEl.getAttribute('content') : undefined;

export default {
  mixins: [UtilsMixin],
  components: {StatusToolBar},
  props: {
    activeTab: {
      type: String
    }
  },
  data() {
    return {
      traces: [],
      ZIPKIN_URL
    };
  },
  created() {
    this.fetch();
  },
  computed: {
    tracesFlatten() {
      return this.traces
        .map(spans => {
          if (spans.length === 0) {
            return null;
          }
          spans.sort((a, b) => a.timestamp - b.timestamp);
          return {
              ...spans[0],
              spans
          };
        })
        .filter(trace => !!trace);
    }
  },
  methods: {
    async fetch() {
      const response = await fetch(ZIPKIN_URL + '/api/v2/traces?limit=100');
      const json = await response.json();
      this.traces = json;
    },
    dateStr(v) {
      if (!v) {
        return '';
      }
      return new Date(v).toISOString();
    }
  }
};
</script>

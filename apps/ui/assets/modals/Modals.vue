<template>
  <div class="modals" @mousedown.self="close()">
    <component :is="current.component" v-bind="current.props" v-on="current.events" v-if="current"></component>
  </div>
</template>
<script lang="ts">
export default {
  data() {
    return {
      attached: false,
    };
  },
  created() {
    this.handler = (event) => {
      if (event.key === 'Escape') {
        this.close();
      }
    };
  },
  computed: {
    modals() {
      return this.$root.modals;
    },
    hasModal() {
      if (!this.modals) return false;
      return this.modals.length > 0;
    },
    current() {
      if (!this.modals || this.modals.length == 0) {
        return false;
      }
      const modal = this.modals[this.modals.length - 1];
      const origEvents = modal.events || {};
      const events = Object.assign({}, origEvents);
      events.close = (data) => {
        this.$root.$removeModal();
        if (origEvents.close) {
          origEvents.close(data);
        }
      };
      events.dismiss = (data) => {
        this.$root.$removeModal();
        if (origEvents.dismiss) {
          origEvents.dismiss(data);
        }
      };
      return {
        component: modal.component,
        props: modal.props,
        events
      };
    }
  },
  watch: {
    'modals'() {
      if (this.hasModal) {
        document.body.classList.add('modals-open');
        if (!this.attached) {
          document.addEventListener('keydown', this.handler);
          this.attached = true;
        }
      } else {
        document.body.classList.remove('modals-open');
        if (this.attached) {
          document.removeEventListener('keydown', this.handler);
          this.attached = false;
        }
      }
      document.querySelector('.modals').scrollTop = 0;
    }
  },
  methods: {
    close() {
      this.$root.$removeModal();
    }
  }
};
</script>

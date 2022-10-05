<template>
  <div class="dropdown">
    <div class="input-group">
      <input ref="searchInput" class="form-control" @focus="onFocued" @blur="onBlurred" @keydown="onKeyDown" placeholder="Search [/]" v-model="query" />
    </div>
    <ul ref="dropdown" class="dropdown-menu" :class="{ show: open && links.length > 0 }" @keydown="onKeyDownDropDown" >
      <li v-for="link in links" :key="link.path">
        <a class="dropdown-item" :href="'/drive/' + driveId + link.path">
          {{ link.title }}<br/>
          <small>{{ link.path }}</small>
        </a>
      </li>
    </ul>
  </div>
</template>
<script>

import {UtilsMixin} from './UtilsMixin.mjs';

export default {
  data() {
    return {
      open: false,
      query: '',
      lastFocused: null,
      links: [],
      searchHandle: null
    };
  },
  mounted() {
    document.addEventListener('keydown', this.keyListener);
  },
  unmounted() {
    document.removeEventListener('keydown', this.keyListener);
  },
  mixins: [UtilsMixin],
  watch: {
    async query() {
      if (this.searchHandle) {
        clearTimeout(this.searchHandle);
      }
      this.searchHandle = setTimeout(() => this.performSearch(), 500);
    }
  },
  methods: {
    async performSearch() {
      const response = await this.SearchClientService.search(this.driveId, this.query);
      this.links = response?.result || [];
      this.searchHandle = null;
    },
    keyListener(event) {
      switch (event.target.tagName) {
        case 'TEXTAREA':
        case 'INPUT':
          if ('Escape' === event.key) {
            if (event.target === this.$refs.searchInput && this.lastFocused) {
              this.lastFocused.focus();
              this.lastFocused = null;
              return;
            }
            this.lastFocused = event.target;
            event.target.blur();
          }
          return;
        case 'BODY':
          if ('Escape' === event.key) {
            if (this.lastFocused) {
              this.lastFocused.focus();
              this.lastFocused = null;
            }
          }
          break;
      }
      if (event.key === '/') {
        if (!this.lastFocused) {
          this.lastFocused = event.target;
        }
        this.$refs.searchInput.focus();
        event.preventDefault();
        event.stopPropagation();
      }
    },
    onFocued() {
      this.open = true;
    },
    onBlurred() {
      this.$nextTick(() => {
        if (this.$refs.dropdown.contains(document.activeElement)) {
          return;
        }
        setTimeout(() => {
          this.open = false;
        }, 500);
      });
    },
    onKeyDown(event) {
      if ('ArrowDown' === event.key) {
        this.$refs.dropdown.querySelector('a')?.focus();
      }
    },
    onKeyDownDropDown(event) {
      if ('A' === event.target.tagName) {
        const allLinks = this.$refs.dropdown.querySelectorAll('a');
        for (let idx = 0; idx < allLinks.length; idx++) {
          if (allLinks[idx] === event.target) {
            if ('ArrowUp' === event.key && idx > 0) {
              allLinks[idx - 1].focus();
            }
            if ('ArrowUp' === event.key && idx === 0) {
              this.$refs.searchInput.focus();
            }
            if ('ArrowDown' === event.key && idx < allLinks.length - 1) {
              allLinks[idx + 1].focus();
            }
            return;
          }
        }
      }
    }
  }
};
</script>
<style>
.dropdown-menu {
  position: fixed;
  z-index: 9999999;
}
</style>

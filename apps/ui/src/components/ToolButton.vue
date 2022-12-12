<template>
  <li v-if="'nav-item' === type" class="nav-item">
    <router-link v-if="to" class="nav-link" :class="{ active: active }" aria-current="page" @click.prevent="click" :to="to">
      <i v-if="icon" :class="icon"></i>
      {{ title }}<slot></slot>
    </router-link>
    <a v-else class="nav-link cursor-pointer" :class="{ active: active }" aria-current="page" @click.prevent="click">
      <i v-if="icon" :class="icon"></i>
      {{ title }}<slot></slot>
    </a>
  </li>
  <li v-else-if="'list-group-item' === type" class="list-group-item">
    <a :href="href" :target="target">
      <i v-if="icon" :class="icon"></i>
      {{ title }}
    </a>
  </li>
  <a v-else class="btn btn-white text-primary ml-1" @click.prevent="click" href="" :aria-label="title" :title="title"
     :class="{ 'border-bottom': active, 'border-active': active }">
    <i v-if="icon" :class="icon"></i>
    <span v-else>{{title}}</span>
  </a>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.ts';

export default {
  name: 'ToolButton',
  mixins: [UtilsMixin],
  emits: ['click'],
  props: {
    active: Boolean,
    to: Object,
    title: String,
    icon: String,
    href: String,
    target: {
      type: String,
      defaut: '_blank'
    }
  },
  data() {
    return {
      type: ''
    };
  },
  mounted() {
    if (this.$el.parentNode.classList.contains('nav-tabs')) {
      this.type = 'nav-item';
      return;
    }
    if (this.$el.parentNode.classList.contains('list-group')) {
      this.type = 'list-group-item';
      return;
    }
    this.type = '';
  },
  methods: {
    click(event) {
      event.preventDefault();
      event.stopPropagation();
      if (this.to) {
        this.$router.push(this.to);
        return;
      }
      if (this.href) {
        this.openWindow(this.href, this.target);
      }
      this.$emit('click');
    }
  }
};
</script>

<template>
  <PrismEditor
      class="form-control"
      language="toml"
      :model-value="innerValue"
      @update:modelValue="$emit('update:modelValue', $event)"
      :highlight="highlight"
      :line-numbers="true"
  ></PrismEditor>
</template>
<script>
import { PrismEditor } from 'vue-prism-editor';
import 'vue-prism-editor/dist/prismeditor.min.css';

const Prism = window['Prism'];

export default {
  name: 'CodeEditor',
  components: { PrismEditor },
  emits: ['update:modelValue'],
  props: {
    lang: {
      type: String
    },
    modelValue: {
      type: String
    }
  },
  data() {
    return {
      innerValue: ''
    };
  },
  watch: {
    modelValue: {
      deep: true,
      handler() {
        this.innerValue = this.modelValue;
      }
    }
  },
  created() {
    this.innerValue = this.modelValue;
  },
  methods: {
    highlight(code) {
      return Prism.highlight(code, Prism.languages[this.lang], this.lang);
    }
  }
};
</script>

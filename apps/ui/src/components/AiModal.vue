<template>
  <div class="modal open" tabindex="-1" role="dialog">
    <div class="modal-dialog open " role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Ai Bot</h5>
          <button type="button" class="btn-close" @click="close" aria-label="Close"></button>
        </div>
        <div class="modal-body" v-if="answer">
          <div class="justify-content-center">
            <div class="m-3">
              <pre>{{ answer }}</pre>
            </div>
            <div class="modal-footer">
              <button @click="replace" class="btn btn-primary">Replace selection</button>
              <button @click="append" class="btn btn-primary">Append selection</button>
            </div>
          </div>
        </div>
        <div class="modal-footer" v-else>
          <div class="form-group">
            <input class="form-control" size="50" placeholder="prompt..." v-model="question" />
            <button @click="share" class="btn btn-primary">Send</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
export default {
  name: 'AiModal',
  props: ['selection'],
  data() {
    return {
      question: '',
      answer: ''
    };
  },
  methods: {
    close() {
      this.$root.$removeModal();
    },
    async share() {
      const response = await this.authenticatedClient.fetchApi('/api/ai', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          selection: this.selection,
          question: this.question
        })
      });
      const json = await response.json();
      this.answer = json.answer;
    },
    replace() {
      this.$root.$removeModal();
      this.$emit('replace', this.answer);
    },
    append() {
      this.$root.$removeModal();
      this.$emit('append', this.answer);
    }
  }
};
</script>

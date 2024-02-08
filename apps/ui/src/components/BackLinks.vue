<template>
  <div class="x-container">
    <slot name="header">
      <h5>Back Links</h5>
    </slot>

    <table class="table table-hover table-clickable table-bordered table-layout-fixed" v-if="backlinks && backlinks.length > 0">
      <tbody>
      <tr v-for="(item, idx) of backlinks" :key="idx" @click="selectFile(item.path)">
        <td class="text-overflow" data-bs-toggle="tooltip" data-bs-placement="top" :title="item.path">
          <button class="btn btn-sm float-end" @click.prevent.stop="goToGDocs(item.fileId)"><i class="fa-brands fa-google-drive"></i></button>
          <span>{{item.path}}</span>
        </td>
      </tr>
      </tbody>
    </table>
    <div v-else>
      No BackLinks
    </div>

    <h5>Links</h5>

    <table class="table table-hover table-clickable table-bordered table-layout-fixed" v-if="links && links.length > 0">
      <tbody>
      <tr v-for="(item, idx) of links" :key="idx" @click="selectFile(item.path)">
        <td class="text-overflow" data-bs-toggle="tooltip" data-bs-placement="top" :title="item.path">
          <button class="btn btn-sm float-end" @click.prevent.stop="goToGDocs(item.fileId)"><i class="fa-brands fa-google-drive"></i></button>
          <span>{{item.path}}</span>
        </td>
      </tr>
      </tbody>
    </table>
    <div v-else>
      No Links
    </div>

    <svg ref="graph" width="830" height="300" viewBox="0 0 830 300" style="max-width: 100%; height: auto;">
      <defs>
        <marker id="arrow" viewBox="0 -10 20 20" refX="100" refY="0" markerWidth="8" markerHeight="8" orient="auto">
          <path class="cool arrowHead" d="M0,-10L20,0L0,10" style="fill: teal; stroke: teal;"></path>
        </marker>
      </defs>
<!--
      <line class="cool" x1="100" y1="150" x2="130" y2="150" stroke="teal" stroke-width="1" marker-end="url(#arrow)"></line>
-->
    </svg>
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.ts';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

export default {
  mixins: [UtilsMixin],
  props: {
    selectedFile: Object,
    contentDir: String
  },
  data() {
    return {
      backlinks: [],
      links: [],
      graphData: {
        edges: [],
        nodes: []
      }
    };
  },
  async created() {
    await this.fetch();
  },
  watch: {
    async selectedFile(a, b) {
      if (a.id !== b.id || a.version !== b.version) {
        await this.fetch();
      }
    }
  },
  methods: {
    async fetch() {
      if (this.selectedFile.id) {
        const { backlinks, links } = await this.FileClientService.getBacklinks(this.driveId, this.selectedFile.id);
        this.backlinks = backlinks;
        this.links = links;
      } else {
        this.backlinks = [];
        this.links = [];
      }
      this.updateGraph();
    },
    selectFile(path) {
      if (this.isAddon) {
        const routeData = this.$router.resolve('/drive/' + this.driveId + this.contentDir + path);
        window.open(routeData.href, '_blank');
      } else {
        this.$router.push('/drive/' + this.driveId + this.contentDir + path);
      }
    },
    updateGraph() {
      const data = {
        edges: [],
        nodes: []
      };

      {
        const nodes = {
          [this.selectedFile.id]: {
            id: this.selectedFile.id,
            title: this.selectedFile.fileName,
            path: this.selectedFile.path,
            group: 0
          }
        };

        for (const row of this.links) {
          nodes[row.fileId] = {
            id: row.fileId,
            title: row.name,
            path: row.path,
            group: 1
          };
          data.edges.push({
            source: this.selectedFile.id,
            target: row.fileId,
            value: 1
          });
        }
        for (const row of this.backlinks) {
          nodes[row.fileId] = {
            id: row.fileId,
            title: row.name,
            path: row.path,
            group: 2
          };
          data.edges.push({
            source: row.fileId,
            target: this.selectedFile.id,
            value: 1
          });
        }

        for (const nodeId of Object.keys(nodes)) {
          data.nodes.push(nodes[nodeId]);
        }
      }

      const svg = d3.select(this.$refs.graph);

      this.graphData.edges = data.edges.map(d => ({...d}));
      this.graphData.nodes = data.nodes.map(d => ({...d}));

      const width = 830;
      const height = 300;

      // Specify the color scale.
      const color = d3.scaleOrdinal(d3.schemeCategory10);

      // Add a line for each link, and a circle for each node.
      const link = svg.append('g')
        .attr('stroke', '#999')
        .attr('stroke-width', 4)
        .attr('stroke-opacity', 0.6)
        .selectAll()
        .data(this.graphData.edges)
        .join('line')
        .attr('marker-end', 'url(#arrow)')
        .attr('stroke-width', d => Math.sqrt(d.value));

      const node = svg.append('g')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .selectAll()
        .data(this.graphData.nodes)
        .join('circle')
        .style('cursor', d => d.group !== 0 ? 'pointer' : undefined)
        .attr('r', 30)
        .attr('fill', d => color(d.group));

      const texts = svg.selectAll('text.label')
        .data(this.graphData.nodes)
        .enter().append('text')
        .attr('class', 'label')
        .attr('fill', '#999')
        .style('cursor', d => d.group !== 0 ? 'pointer' : undefined)
        .style('text-anchor', 'middle')
        .text(function(d) {  return d.title;  });


      // Set the position attributes of edges and nodes each time the simulation ticks.
      function ticked() {
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);

        node
          .attr('cx', d => d.x)
          .attr('cy', d => d.y);

        texts.attr('transform', function(d) {
          return 'translate(' + d.x + ',' + d.y + ')';
        });
      }
      // Create a simulation with several forces.
      const simulation = d3.forceSimulation(this.graphData.nodes)
        .force('link', d3.forceLink(this.graphData.edges).id(d => d.id).distance(200))
        .force('charge', d3.forceManyBody())
        .force('center', d3.forceCenter(width / 2, height / 2))
        .on('tick', ticked);

      node.append('title')
        .text(d => d.title);

      // Add a drag behavior.
      node.call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

      node.on('click', (element, data) => {
        this.$router.push('/drive/' + this.driveId + this.contentDir + data.path + '#drive_backlinks');
      });
      texts.on('click', (element, data) => {
        this.$router.push('/drive/' + this.driveId + this.contentDir + data.path + '#drive_backlinks');
      });
      // Reheat the simulation when drag starts, and fix the subject position.
      function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }

      // Update the subject (dragged node) position during drag.
      function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }

      // Restore the target alpha so the simulation cools after dragging ends.
      // Unfix the subject position now that it’s no longer being dragged.
      function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }

      // When this cell is re-run, stop the previous simulation. (This doesn’t
      // really matter since the target alpha is zero and the simulation will
      // stop naturally, but it’s a good practice.)
      //  invalidation.then(() => simulation.stop());
    }
  }
};
</script>

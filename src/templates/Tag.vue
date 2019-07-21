<template>
  <Layout>
    <span>{{$page.tag.id}}</span>
    <p>Gli articoli con questo tag sono:</p>
    <ul>
      <li v-for="edge in belongsToEdges" :key="edge.node.id">
        <g-link :to="`${edge.node.path}`">{{ edge.node.title}}</g-link>
      </li>
    </ul>
  </Layout>
</template>

<page-query>
query Tag ($id: String!) {
  tag: tag (id: $id) {
    id
		path
    belongsTo {
      edges {
        node {
          ... on Post {
            title
            path
            id
          }
        }
      }
    }
  }
}
</page-query>

<script>
export default {
  mounted() {
    console.log({ page: this.$page });
    console.log({ belTo: this.belongsToEdges });
  },
  metaInfo() {
    return {
      title: this.$page.tag.id
    };
  },
  computed: {
    belongsToEdges() {
      return this.$page.tag.belongsTo.edges;
    }
  }
};
</script>

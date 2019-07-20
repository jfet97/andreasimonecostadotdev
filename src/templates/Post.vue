<template>
  <Layout>
    <h1 v-html="$page.post.title"></h1>
    <br />
    <div v-html="$page.post.content" />
    <span>Autore</span>
    <br />
    <span>Tags</span>
    <br />
    <ul>
      <li v-for="tag in $page.post.tags" :key="tag.id">
        <g-link :to="`${tag.path}`">#{{ tag.id }}</g-link>
      </li>
    </ul>
  </Layout>
</template>

<page-query>
query Post ($path: String!) {
  post: post (path: $path) {
    title
    content
    path
  }
}
</page-query>

<script>
export default {
  metaInfo() {
    return {
      title: this.$page.post.title
    };
  }
};
</script>

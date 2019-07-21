<template>
  <Layout>
    <h1 v-html="$page.post.title"></h1>
    <br />
    <div v-html="$page.post.content" />
    <span>Autore</span>
    <br />
    <span>Tags</span>
    <br />
		<g-image :src="$page.post.cover_image" width="150" alt="A person" fit="cover"/> <!-- nn si riesce di settare l'atezza/larghezza...no buono -->
    <ul>
      <li v-for="tag in $page.post.tags" :key="tag.id">
        <g-link :to="`${tag.path}`">#{{ tag.id }}</g-link>
      </li>
    </ul>
  </Layout>
  <!-- inserire cover image qua -->
</template>

<page-query>
query Post ($path: String!) {
  post: post (path: $path) {
    title
    content
    path
		cover_image
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

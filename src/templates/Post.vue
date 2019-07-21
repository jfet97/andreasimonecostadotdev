<template>
  <Layout>
    <h1 v-html="$page.post.title"></h1>
    <br />
    <div v-html="$page.post.content" />
    <span>Autore</span>
    <br />
    <span>Tags</span>
    <ul>
      <li v-for="(tag, i) in $page.post.tags" :key="i">
        <g-link :to="`${tag.path}`">#{{ tag.title }}</g-link>
      </li>
    </ul>
    <br />
    <g-image :src="$page.post.cover_image" width="150" alt="A person" fit="cover" />
    <!-- nn si riesce di settare l'atezza/larghezza...no buono -->
  </Layout>
  <!-- inserire cover image qua -->
</template>

<page-query>
query Post ($path: String!) {
  post: post (path: $path) {
    title
    content
    path
		tags {
			title
			path
		}
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
  },
  created() {
    console.log({ post: this.$page.post });
  }
};
</script>

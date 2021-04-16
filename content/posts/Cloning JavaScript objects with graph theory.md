+++
author = "Andrea Simone Costa"
title = "Cloning JavaScript objects with graph theory"
date = "2021-03-20"
description = "Let's learn something about graph theory to properly clone JavaScript objects, both with and without circular references."
categories = ["javascript"]
tags = ["objects", "graphs", "graph theory"]
featuredImage = "/images/graphs/beee.jpg"
images = ["/images/graphs/beee.jpg"]
draft = true
+++

## Introduction

The JavaScript slang allow us to clone objects in more than one way. We can perform a shallow clone using `Object.assign` or the spread syntax and a deep clone thanks to the `JSON.parse(JSON.stringify())` trick.
Unfortunately, the last solution suffers from a problem: `JSON.stringify` cannot work on an object that has circular references, erroring out in such a case.

In this episode we'll learn a bit of graph theory to then use this knowledge to build a simple, but efficient, deep cloner.
&nbsp;

## Graphs

A graph is a mathematical structure made up by **vertices**, also called **nodes**, which are connected by **edges**. Here is an example:

{{< svg "/images/graphs/undir.svg" >}}

Graphs allow us to represent complex relationships between data. For example the nodes could stand for the cities of a country and the edges the roads that connect them.

There are two main kind of graphs: **undirected** graphs and **directed** graphs. The former ones, like the graph in the picture above, have edges without an orientation: edges are two-way streets.\
Conversely, directed ones are graphs where the edges have a direction associated with them:

{{< svg "/images/graphs/dir.svg" >}}

&nbsp;

## What do JavaScript objects have to do with graphs?

Let's say we have the following four objects:

```js
const foo = {
    _tag: "foo",
}

const bar = {
    _tag: "bar",
}

const baz = {
    _tag: "baz",
}

const qux = {
    _tag: "qux"
}
```

We can see them like four lonely nodes:

But after having set up the following links between them:

```js
foo.bar = bar;

bar.baz = baz;

baz.qux = qux;

qux.bar = bar;
```

our graph starts to get some edges as well:

where if then there is a directed edge because from we can reach out

## Depth-first Search

One of the most famous algorithm for traversing a graph is the Depth-first search. The algorithm starts at one chosen node and explores as far as possible along each branch before backtracking. It is usually written recursively, but a simple iterative version can be obtained by using a stack data structure (LIFO).

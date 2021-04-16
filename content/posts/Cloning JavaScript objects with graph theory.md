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

{{< svg "/images/graphs/4_alone.svg" >}}

But after having set up the following links between them:

```js
foo.bar = bar;

bar.baz = baz;

baz.qux = qux;

qux.bar = bar;
```

the graph starts to get some edges as well:

{{< svg "/images/graphs/4_not_alone.svg" >}}

In a graph like this there is a __directed edge__ from one node to another iff the source node is an object containing a first-level reference to the object represented by the destination node. That is because we can immediately reach out the latter node from the former.\
In our example there is an edge from `foo` to `bar` because `foo` contains a direct reference to `bar`. On the contrary there is no reference that allow you to go from `bar` to `foo`, so there is not a reversed arrow.

&nbsp;

## Depth-first Search

One of the most famous algorithm for traversing a graph is the so called Depth-First Search. The algorithm starts at __one chosen node__ and explores as far as possible along each branch before backtracking. It is usually written recursively, but a simple iterative version can be obtained by using a __LIFO__ data structure, like a stack.\
Let's discuss a simple recursive implementation in JavaScript:

```js
// well you know, it's javascript...
function isObject(entity) {
    return typeof entity === "object" && entity !== null;
}

// an adjacent node is a node directly reachable by using a first-level reference
function getAdjacentNodes(obj) {
    return (
        Object.entries(obj)
        .filter(([, v]) => isObject(v));
    )
}

// understanding this function is not so important, feel free to skip it
function safePrint(obj) {
    console.log(
        JSON.stringify(
            obj,
            function (key, value) {
                const isVObject = isObject(value);
                const isNode = isVObject && key === "";
                if(isNode || !isVObject) return value;
                else return key;
            },
            4
        )
    );
}

// it does the hard work, traversing the graph
function _DFS(node, visitedNodes) {

    // if we have already encountered this node
    // we can skip it
    if(visitedNodes.has(node)) {
        return;
    }

    // otherwise we print the current node
    safePrint(node);

    // then we set the node as visited
    visitedNodes.add(node, true);

    // now we recursively visit each adjacent node
    for (const [, n] of getAdjacentNodes(node)) {
        _DFS(n, visitedNodes);
    }

    // easy peasy
}

// the object 'obj' is the starting point for our faboulous graph trip
function DFS(obj) {
    return _DFS(obj, new Set());
}
```

// 1 spiega visita nodi ricorsiva evitare cicli infiniti
// 2 dire che in base a dove si parte si raggiungono diversi risultati
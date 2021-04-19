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

In a graph like this there is a __directed edge__ from one node to another iff the source node is an object containing a _first-level reference_ to the object represented by the destination node. That is because we can immediately reach out the latter node from the former.\
In our example there is an edge from `foo` to `bar` because `foo` contains a direct reference to `bar`. On the contrary there is no reference that allow you to go from `bar` to `foo`, so there is not a reversed arrow.

&nbsp;

## Depth-First Search

One of the most famous algorithm for traversing a graph is the so called Depth-First Search. The algorithm starts at __one chosen node__ and explores as far as possible along each branch before backtracking. It is usually written recursively, but a simple iterative version can be obtained by using a __LIFO__ data structure, like a stack.\
We will discuss recursive implementation in JavaScript.

First let's have a look at the following helper functions that we'll be using throughout the article.

### isObject

```js
function isObject(entity) {
    return typeof entity === "object" && entity !== null;
}
```

Well you know, it's JavaScript. You can never be too sure eheh.

### getAdjacentNodes

```js
// an adjacent node is a node directly reachable by using a first-level reference
function getAdjacentNodes(obj) {
    return (
        Object.entries(obj)
        .filter(([, v]) => isObject(v));
    )
}
```

This function extracts out those we have defined as first-level references: all the `obj`'s first-level fields that are references to other objects.

### safePrint

```js
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
```

Understanding this function is not so important, feel free to skip it. Its purpose is providing a safe way to print the fist-level fields of objects that may have circular references.

Now it's time for the depth first search:

```js
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

Nothing so scary, right?\
It uses a `Set` to avoid re-analazying a node that has been already visited, so that the graph visit does end. That's because a graph can have cycles, that is a path that starts from a node and at the end returns to the node from which it has started. In the world of JavaScript objects it translates in the fact that there could be circular references. An object can even be self-referencing!

So if we have already visited a node we return immediately. Otherwise we print its frst-level fields to then visit recursively its neighborhood. This is a DFS!

Obviously the output will be different based on the starting node. Calling the `DFS` function on `foo` will print:

```js
'{
    "_tag": "foo",
    "bar": "bar"
}'
'{
    "_tag": "bar",
    "baz": "baz"
}'
'{
    "_tag": "baz",
    "qux": "qux"
}'
'{
    "_tag": "qux",
    "bar": "bar"
}'
````

Instead, if we called it on `qux` we'll have:

```js
'{
    "_tag": "qux",
    "bar": "bar"
}'
'{
    "_tag": "bar",
    "baz": "baz"
}'
'{
    "_tag": "baz",
    "qux": "qux"
}'
```

It's not possible to reach out `foo` from `qux`, neither with a first-level reference nor with any path in the graph.
